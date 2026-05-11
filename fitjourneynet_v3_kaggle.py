# ══════════════════════════════════════════════════════════════════════
# FitJourneyNet V3 — Full Training Script for Kaggle
# Custom IP, No Pretrained Weights
# Target: 13 body keypoints, Joint Angle MAE < 8° by epoch 50
# ══════════════════════════════════════════════════════════════════════

# CELL 1 — Install Dependencies
# ──────────────────────────────
# !pip install -q albumentations onnxruntime

# CELL 2 — Imports & Config
# ─────────────────────────
import os, json, math, time, copy
import numpy as np
import cv2
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader, ConcatDataset, WeightedRandomSampler
from torch.cuda.amp import GradScaler, autocast
import albumentations as A

# ── Paths (Kaggle) ──────────────────────────────────────────────────
COCO_ROOT      = '/kaggle/input/coco-2017-dataset/coco2017'
OCHUMAN_ROOT   = '/kaggle/input/ochuman'  # optional, skip if not available
CHECKPOINT_PATH = '/kaggle/working/fitjourney_v3_checkpoint.pth'
BEST_PATH       = '/kaggle/working/fitjourney_net_v3_best.pth'

# ── Keypoint Config ──────────────────────────────────────────────────
# Map V3 index → COCO index → Name
# 0→0 nose | 1→5 L_shoulder | 2→6 R_shoulder | 3→7 L_elbow | 4→8 R_elbow
# 5→9 L_wrist | 6→10 R_wrist | 7→11 L_hip | 8→12 R_hip
# 9→13 L_knee | 10→14 R_knee | 11→15 L_ankle | 12→16 R_ankle
COCO_INDICES = [0, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
NUM_KP = 13

BODY_KP_FILTER = [5, 6, 11, 12, 13, 14]  # COCO indices for visibility filter

KP_WEIGHTS = torch.tensor([
    1.0,  # nose
    3.0, 3.0,   # shoulders
    2.5, 2.5,   # elbows
    2.5, 2.5,   # wrists
    4.0, 4.0,   # hips
    4.0, 4.0,   # knees
    3.0, 3.0,   # ankles
])

INPUT_SIZE  = 256
HEATMAP_SIZE = 64
EPOCHS      = 50
BATCH_SIZE  = 64
WORKERS     = 4

# CELL 3 — Architecture
# ─────────────────────

class DepthwiseSeparable(nn.Module):
    def __init__(self, in_ch, out_ch, stride=1, use_se=True):
        super().__init__()
        mid_ch = in_ch * 3
        self.use_skip = (stride == 1 and in_ch == out_ch)
        self.dw   = nn.Conv2d(in_ch, mid_ch, 3, stride, 1, groups=in_ch, bias=False)
        self.bn1  = nn.BatchNorm2d(mid_ch)
        self.act1 = nn.Hardswish(inplace=True)
        self.use_se = use_se
        if use_se:
            self.se_pool = nn.AdaptiveAvgPool2d(1)
            self.se_fc1  = nn.Conv2d(mid_ch, max(1, mid_ch // 4), 1)
            self.se_relu = nn.ReLU(inplace=True)
            self.se_fc2  = nn.Conv2d(max(1, mid_ch // 4), mid_ch, 1)
            self.se_sig  = nn.Sigmoid()
        self.pw  = nn.Conv2d(mid_ch, out_ch, 1, bias=False)
        self.bn2 = nn.BatchNorm2d(out_ch)

    def forward(self, x):
        out = self.act1(self.bn1(self.dw(x)))
        if self.use_se:
            se = self.se_sig(self.se_fc2(self.se_relu(self.se_fc1(self.se_pool(out)))))
            out = out * se
        out = self.bn2(self.pw(out))
        return x + out if self.use_skip else out


class FitJourneyBackbone(nn.Module):
    """3-stage lightweight backbone. Returns (s1@64, s2@32, s3@16)."""
    def __init__(self):
        super().__init__()
        self.stem   = nn.Sequential(
            nn.Conv2d(3, 16, 3, 2, 1, bias=False), nn.BatchNorm2d(16), nn.Hardswish(inplace=True)
        )
        self.stage1 = nn.Sequential(DepthwiseSeparable(16, 32, stride=2))
        self.stage2 = nn.Sequential(DepthwiseSeparable(32, 64, stride=2), DepthwiseSeparable(64, 64))
        self.stage3 = nn.Sequential(
            DepthwiseSeparable(64, 128, stride=2),
            DepthwiseSeparable(128, 128),
            DepthwiseSeparable(128, 128),
        )

    def forward(self, x):
        x  = self.stem(x)
        s1 = self.stage1(x)   # 64×64
        s2 = self.stage2(s1)  # 32×32
        s3 = self.stage3(s2)  # 16×16
        return s1, s2, s3


class FitJourneyNetV3(nn.Module):
    def __init__(self, num_kp=NUM_KP):
        super().__init__()
        self.backbone = FitJourneyBackbone()

        # Lateral connections
        self.lat2 = nn.Conv2d(64,  64, 1)
        self.lat1 = nn.Conv2d(32,  64, 1)

        # Upsample refinement blocks
        self.up1  = DepthwiseSeparable(128, 64)
        self.up2  = DepthwiseSeparable(64,  64)

        # Heatmap head
        self.head = nn.Sequential(
            nn.Conv2d(64, 128, 3, 1, 1), nn.BatchNorm2d(128), nn.ReLU(inplace=True),
            nn.Conv2d(128, num_kp, 1)
        )

    def forward(self, x):
        s1, s2, s3 = self.backbone(x)
        p3 = F.interpolate(s3, size=s2.shape[-2:], mode='bilinear', align_corners=False)
        p3 = self.up1(p3)                              # 32×32, 64ch
        p2 = self.lat2(s2) + p3
        p2 = F.interpolate(p2, size=s1.shape[-2:], mode='bilinear', align_corners=False)
        p2 = self.up2(p2)                              # 64×64, 64ch
        p1 = self.lat1(s1) + p2
        return self.head(p1)                           # (B,13,64,64) raw logits


# CELL 4 — Loss Function
# ──────────────────────

def weighted_heatmap_loss(pred, target, vis, kp_weights):
    """
    pred:       (B, K, H, W) raw logits
    target:     (B, K, H, W) gaussian heatmaps
    vis:        (B, K) 0/1 visibility
    kp_weights: (K,)  per-keypoint importance weights
    """
    B, K, H, W = pred.shape
    w = kp_weights.to(pred.device)                    # (K,)
    vis = vis.to(pred.device)                         # (B, K)

    diff  = (pred - target) ** 2                      # (B,K,H,W)
    per_kp = diff.mean(dim=(-2, -1))                  # (B,K)

    # Weight by visibility and KP importance
    weighted = per_kp * vis * w.unsqueeze(0)
    total = weighted.sum() / (vis.sum() * w.mean() + 1e-6)
    return total


def make_gaussian_heatmap(joints, vis, hm_size=64, sigma=2.0):
    """joints: (K,2) in [0, hm_size], vis: (K,)"""
    K = joints.shape[0]
    hms = np.zeros((K, hm_size, hm_size), dtype=np.float32)
    size = 6 * sigma + 1
    g_x = np.arange(0, size, 1) - size // 2
    g_y = g_x[:, np.newaxis]
    g   = np.exp(-(g_x**2 + g_y**2) / (2 * sigma**2))

    for k in range(K):
        if vis[k] < 0.5:
            continue
        px, py = int(joints[k, 0]), int(joints[k, 1])
        x0, x1 = max(0, px - size // 2), min(hm_size, px + size // 2 + 1)
        y0, y1 = max(0, py - size // 2), min(hm_size, py + size // 2 + 1)
        gx0 = max(0, -(px - size // 2))
        gy0 = max(0, -(py - size // 2))
        gx1 = gx0 + (x1 - x0)
        gy1 = gy0 + (y1 - y0)
        if x0 < x1 and y0 < y1:
            hms[k, y0:y1, x0:x1] = np.maximum(hms[k, y0:y1, x0:x1], g[gy0:gy1, gx0:gx1])
    return hms


# CELL 5 — Dataset
# ────────────────

AUGMENT = A.Compose([
    A.HorizontalFlip(p=0.5),
    A.ShiftScaleRotate(shift_limit=0.1, scale_limit=0.3, rotate_limit=40,
                       border_mode=cv2.BORDER_CONSTANT, p=0.8),
    A.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.3, hue=0.1, p=0.7),
    A.GaussianBlur(blur_limit=3, p=0.2),
    A.CoarseDropout(max_holes=8, max_height=32, max_width=32, p=0.3),
], keypoint_params=A.KeypointParams(
    format='xy', extra_fields=['orig_idx'],
    remove_invisible=False, filter_invalid_keypoints=True
))

MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)


class COCOPoseDataset(Dataset):
    def __init__(self, root, split='train', augment=True):
        self.root    = root
        self.augment = augment
        ann_file = os.path.join(root, 'annotations', f'person_keypoints_{split}2017.json')
        with open(ann_file) as f:
            data = json.load(f)
        self.id2img = {img['id']: img for img in data['images']}
        self.samples = []
        for ann in data['annotations']:
            if ann.get('num_keypoints', 0) < 3:
                continue
            kps = np.array(ann['keypoints']).reshape(-1, 3)
            # Keep only if ≥3 body keypoints visible
            body_vis = sum(1 for ci in BODY_KP_FILTER if kps[ci, 2] > 0)
            if body_vis < 3:
                continue
            bbox = ann['bbox']
            if bbox[2] < 32 or bbox[3] < 32:
                continue
            img_info = self.id2img[ann['image_id']]
            self.samples.append({
                'img_path': os.path.join(root, f'{split}2017', img_info['file_name']),
                'bbox': bbox,
                'keypoints': kps,
            })
        print(f'COCO {split}: {len(self.samples)} samples')

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        s   = self.samples[idx]
        img = cv2.cvtColor(cv2.imread(s['img_path']), cv2.COLOR_BGR2RGB)
        kps_full = s['keypoints']                         # (17,3)
        kps      = kps_full[COCO_INDICES]                 # (13,3)
        joints   = kps[:, :2].copy().astype(np.float32)   # (13,2)
        vis      = (kps[:, 2] > 0).astype(np.float32)     # (13,)

        # Person crop with 20% padding
        x, y, w, h = s['bbox']
        pad = 0.2
        x1 = max(0, int(x - w * pad))
        y1 = max(0, int(y - h * pad))
        x2 = min(img.shape[1], int(x + w * (1 + pad)))
        y2 = min(img.shape[0], int(y + h * (1 + pad)))
        crop = img[y1:y2, x1:x2]
        joints[:, 0] -= x1
        joints[:, 1] -= y1

        if crop.shape[0] < 4 or crop.shape[1] < 4:
            crop = np.zeros((64, 64, 3), dtype=np.uint8)
            joints[:] = 0; vis[:] = 0

        # Scale joints to INPUT_SIZE
        scale_x = INPUT_SIZE / max(crop.shape[1], 1)
        scale_y = INPUT_SIZE / max(crop.shape[0], 1)
        crop    = cv2.resize(crop, (INPUT_SIZE, INPUT_SIZE))
        joints[:, 0] *= scale_x
        joints[:, 1] *= scale_y

        # Augmentation
        if self.augment:
            kp_list = [(joints[k, 0], joints[k, 1], k) for k in range(NUM_KP)]
            try:
                aug = AUGMENT(image=crop, keypoints=kp_list)
                new_joints = joints.copy()
                new_vis    = vis.copy()
                for (xa, ya, orig_k) in aug['keypoints']:
                    ki = int(orig_k)
                    new_joints[ki] = [xa, ya]
                    # Mark invisible if went out of bounds
                    if xa < 0 or xa >= INPUT_SIZE or ya < 0 or ya >= INPUT_SIZE:
                        new_vis[ki] = 0
                joints = new_joints
                vis    = new_vis
                crop   = aug['image']
            except Exception:
                pass

        # Heatmap targets (scale joints to heatmap space)
        hm_joints = joints * (HEATMAP_SIZE / INPUT_SIZE)
        heatmaps  = make_gaussian_heatmap(hm_joints, vis, HEATMAP_SIZE)

        # Normalize image
        img_t = crop.astype(np.float32) / 255.0
        img_t = (img_t - MEAN) / STD
        img_t = torch.from_numpy(img_t.transpose(2, 0, 1))

        return img_t, torch.from_numpy(heatmaps), torch.from_numpy(vis)


# CELL 6 — Validation Metrics
# ────────────────────────────

def compute_angle(A, B, C):
    """Angle at B, vectors BA and BC."""
    v1 = A - B; v2 = C - B
    cos_a = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6)
    return np.degrees(np.arccos(np.clip(cos_a, -1, 1)))


def extract_keypoints_batch(pred_hm):
    """pred_hm: (B,K,H,W) numpy. Returns joints (B,K,2) in [0,1] and conf (B,K)."""
    B, K, H, W = pred_hm.shape
    flat  = pred_hm.reshape(B, K, -1)
    idx   = flat.argmax(-1)             # (B,K)
    confs = 1 / (1 + np.exp(-flat.max(-1)))  # sigmoid of max logit
    rows  = idx // W
    cols  = idx % W
    joints = np.stack([cols / W, rows / H], axis=-1)   # (B,K,2) normalized
    return joints, confs


def validate(model, loader, device):
    model.eval()
    pckh_correct = 0; pckh_total = 0
    angle_errors = []

    with torch.no_grad():
        for imgs, hm_gt, vis in loader:
            imgs = imgs.to(device)
            pred = model(imgs).cpu().numpy()   # (B,K,64,64)
            vis_np = vis.numpy()

            joints_pred, confs = extract_keypoints_batch(pred)
            joints_gt, _       = extract_keypoints_batch(hm_gt.numpy())

            B = pred.shape[0]
            for b in range(B):
                kp_p = joints_pred[b]   # (13,2)
                kp_g = joints_gt[b]
                v    = vis_np[b]

                # Body PCKh@0.5 (indices 1-12, use shoulder-hip dist as normalizer)
                if v[1] > 0 and v[2] > 0 and v[7] > 0 and v[8] > 0:
                    sh_mid  = (kp_g[1] + kp_g[2]) / 2
                    hip_mid = (kp_g[7] + kp_g[8]) / 2
                    norm    = np.linalg.norm(sh_mid - hip_mid)
                    if norm > 1e-4:
                        for k in range(1, 13):
                            if v[k] > 0:
                                dist = np.linalg.norm(kp_p[k] - kp_g[k])
                                pckh_correct += int(dist < 0.5 * norm)
                                pckh_total   += 1

                # Joint Angle MAE
                def ang_err(a, b, c):
                    if v[a] > 0 and v[b] > 0 and v[c] > 0:
                        pred_a = compute_angle(kp_p[a], kp_p[b], kp_p[c])
                        gt_a   = compute_angle(kp_g[a], kp_g[b], kp_g[c])
                        angle_errors.append(abs(pred_a - gt_a))

                ang_err(7, 9, 11)   # L knee
                ang_err(8, 10, 12)  # R knee
                ang_err(1, 3, 5)    # L elbow
                ang_err(2, 4, 6)    # R elbow
                ang_err(1, 7, 9)    # L hip

    pckh = 100.0 * pckh_correct / max(pckh_total, 1)
    mae  = np.mean(angle_errors) if angle_errors else 999.0
    return pckh, mae


# CELL 7 — Training Loop
# ──────────────────────

def train():
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f'Device: {device}')

    # Datasets
    coco_train = COCOPoseDataset(COCO_ROOT, split='train', augment=True)
    coco_val   = COCOPoseDataset(COCO_ROOT, split='val',   augment=False)

    train_loader = DataLoader(coco_train, batch_size=BATCH_SIZE, shuffle=True,
                              num_workers=WORKERS, pin_memory=True, drop_last=True)
    val_loader   = DataLoader(coco_val,   batch_size=BATCH_SIZE, shuffle=False,
                              num_workers=WORKERS, pin_memory=True)

    model     = FitJourneyNetV3(num_kp=NUM_KP).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    scaler    = GradScaler()
    kp_w      = KP_WEIGHTS.to(device)

    # OneCycleLR for Phase 1 (epochs 1-10)
    scheduler = torch.optim.lr_scheduler.OneCycleLR(
        optimizer, max_lr=1e-3,
        steps_per_epoch=len(train_loader), epochs=10, pct_start=0.3
    )

    start_epoch  = 0
    best_mae     = 999.0
    best_pckh    = 0.0

    # Resume
    if os.path.exists(CHECKPOINT_PATH):
        print('Resuming from checkpoint...')
        ckpt = torch.load(CHECKPOINT_PATH, map_location=device)
        model.load_state_dict(ckpt['model_state'])
        optimizer.load_state_dict(ckpt['optimizer_state'])
        start_epoch = ckpt['epoch'] + 1
        best_mae    = ckpt.get('best_angle_mae', 999.0)
        best_pckh   = ckpt.get('best_pckh', 0.0)
        print(f'Resumed at epoch {start_epoch}, best MAE={best_mae:.2f}°')

    for epoch in range(start_epoch, EPOCHS):

        # ── Phase transitions ─────────────────────────────────────
        if epoch == 10:
            # Phase 2: continue at 1e-3 flat
            for pg in optimizer.param_groups:
                pg['lr'] = 1e-3
            scheduler = None
            print('Phase 2 started: flat LR=1e-3')

        if epoch == 40:
            # Phase 3: fine-tune at 1e-4
            for pg in optimizer.param_groups:
                pg['lr'] = 1e-4
            scheduler = None
            print('Phase 3 started: fine-tune LR=1e-4')

        # ── Train ─────────────────────────────────────────────────
        model.train()
        epoch_loss = 0.0
        t0 = time.time()

        for step, (imgs, hm_gt, vis) in enumerate(train_loader):
            imgs  = imgs.to(device)
            hm_gt = hm_gt.to(device)
            vis   = vis.to(device)

            with autocast():
                pred = model(imgs)
                loss = weighted_heatmap_loss(pred, hm_gt, vis, kp_w)

            optimizer.zero_grad(set_to_none=True)
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), 5.0)
            scaler.step(optimizer)
            scaler.update()

            if scheduler is not None:
                scheduler.step()

            epoch_loss += loss.item()

            if step % 100 == 0:
                lr = optimizer.param_groups[0]['lr']
                print(f'  Ep{epoch+1} step {step}/{len(train_loader)} '
                      f'loss={loss.item():.4f} lr={lr:.2e}')

        avg_loss = epoch_loss / len(train_loader)
        elapsed  = time.time() - t0

        # ── Validate ──────────────────────────────────────────────
        pckh, mae = validate(model, val_loader, device)
        print(f'\nEpoch {epoch+1}/{EPOCHS} | Loss={avg_loss:.4f} | '
              f'PCKh={pckh:.1f}% | AngleMAE={mae:.2f}° | t={elapsed:.0f}s')

        # ── Save best ─────────────────────────────────────────────
        if mae < best_mae:
            best_mae  = mae
            best_pckh = pckh
            torch.save(model.state_dict(), BEST_PATH)
            print(f'  ★ Best model saved! MAE={mae:.2f}° PCKh={pckh:.1f}%')

        # ── Checkpoint ────────────────────────────────────────────
        torch.save({
            'epoch': epoch,
            'model_state': model.state_dict(),
            'optimizer_state': optimizer.state_dict(),
            'best_angle_mae': best_mae,
            'best_pckh': best_pckh,
        }, CHECKPOINT_PATH)

    print(f'\nTraining complete! Best AngleMAE={best_mae:.2f}° | PCKh={best_pckh:.1f}%')
    return model


# CELL 8 — Run Training
# ─────────────────────

model = train()


# CELL 9 — ONNX Export
# ─────────────────────

import onnx
import onnxruntime as ort
from onnxruntime.quantization import quantize_dynamic, QuantType

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# Load best weights
export_model = FitJourneyNetV3(num_kp=NUM_KP).to(device)
export_model.load_state_dict(torch.load(BEST_PATH, map_location=device))
export_model.eval()

dummy = torch.randn(1, 3, 256, 256).to(device)

ONNX_PATH      = '/kaggle/working/fitjourney_net_v3.onnx'
ONNX_INT8_PATH = '/kaggle/working/fitjourney_net_v3_int8.onnx'

# Export
torch.onnx.export(
    export_model, dummy, ONNX_PATH,
    opset_version=12,
    input_names=['input'], output_names=['heatmaps'],
    dynamic_axes={'input': {0: 'batch'}, 'heatmaps': {0: 'batch'}}
)

# Verify
sess = ort.InferenceSession(ONNX_PATH, providers=['CPUExecutionProvider'])
out  = sess.run(None, {'input': np.random.randn(1, 3, 256, 256).astype(np.float32)})[0]
print(f'ONNX output shape: {out.shape}')   # expect (1, 13, 64, 64)
print(f'ONNX logit range: min={out.min():.2f}, max={out.max():.2f}')
print(f'ONNX file size: {os.path.getsize(ONNX_PATH)/1e6:.2f} MB')

# INT8 Quantization
quantize_dynamic(ONNX_PATH, ONNX_INT8_PATH, weight_type=QuantType.QUInt8)
print(f'INT8 size: {os.path.getsize(ONNX_INT8_PATH)/1e6:.2f} MB')
print('Export complete! Upload fitjourney_net_v3_int8.onnx to your app.')

# ══════════════════════════════════════════════════════════════════════
# BROWSER DECODING — workout-engine.ts
# ══════════════════════════════════════════════════════════════════════
#
# // Model: fitjourney_net_v3_int8.onnx
# // Input:  "input"    float32[batch, 3, 256, 256]  (ImageNet normalized)
# // Output: "heatmaps" float32[batch, 13, 64, 64]  (raw logits)
# //
# // V3 Keypoint Index Map:
# //   0=nose
# //   1=L_shoulder, 2=R_shoulder
# //   3=L_elbow,    4=R_elbow
# //   5=L_wrist,    6=R_wrist
# //   7=L_hip,      8=R_hip
# //   9=L_knee,    10=R_knee
# //  11=L_ankle,   12=R_ankle
# //
# // Decode per keypoint k:
# //   const flat = heatmaps[0][k]           // length 4096
# //   const maxIdx = flat.indexOf(Math.max(...flat))
# //   const col = maxIdx % 64
# //   const row = Math.floor(maxIdx / 64)
# //   const x = col / 64                    // normalized [0,1]
# //   const y = row / 64                    // normalized [0,1]
# //   const confidence = 1 / (1 + Math.exp(-flat[maxIdx]))  // sigmoid
# //   if (confidence < 0.3) mark as not_visible
