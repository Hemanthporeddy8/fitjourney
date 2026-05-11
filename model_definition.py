
import torch
import torch.nn as nn
import torch.nn.functional as F

class DepthwiseSeparable(nn.Module):
    def __init__(self, in_ch, out_ch, stride=1, use_se=True):
        super().__init__()
        self.use_skip = (stride == 1 and in_ch == out_ch)
        mid_ch = in_ch * 3 
        
        layers = [
            nn.Conv2d(in_ch, mid_ch, 3, stride, 1, groups=in_ch, bias=False),
            nn.BatchNorm2d(mid_ch),
            nn.Hardswish(inplace=True),
        ]
        
        if use_se:
            self.se = nn.Sequential(
                nn.AdaptiveAvgPool2d(1),
                nn.Conv2d(mid_ch, mid_ch // 4, 1),
                nn.ReLU(inplace=True),
                nn.Conv2d(mid_ch // 4, mid_ch, 1),
                nn.Sigmoid()
            )
        else:
            self.se = None

        layers += [
            nn.Conv2d(mid_ch, out_ch, 1, bias=False),
            nn.BatchNorm2d(out_ch),
        ]
        self.conv = nn.Sequential(*layers)

    def forward(self, x):
        out = self.conv[0:3](x) 
        if self.se: out = out * self.se(out)
        out = self.conv[3:5](out) 
        if self.use_skip: return x + out
        return out

class FitJourneyBackbone(nn.Module):
    def __init__(self):
        super().__init__()
        self.stem = nn.Sequential(
            nn.Conv2d(3, 24, 3, stride=2, padding=1, bias=False), 
            nn.BatchNorm2d(24),
            nn.Hardswish(inplace=True),
        )
        self.stage1 = nn.Sequential(
            DepthwiseSeparable(24, 48, stride=2), 
            DepthwiseSeparable(48, 48),
        )
        self.stage2 = nn.Sequential(
            DepthwiseSeparable(48, 96, stride=2),
            DepthwiseSeparable(96, 96),
        )
        self.stage3 = nn.Sequential(
            DepthwiseSeparable(96, 192, stride=2),
            DepthwiseSeparable(192, 192),
            DepthwiseSeparable(192, 192),
        )
        self.stage4 = nn.Sequential(
            DepthwiseSeparable(192, 384, stride=2),
            DepthwiseSeparable(384, 384),
        )

    def forward(self, x):
        x = self.stem(x)    
        s1 = self.stage1(x) 
        s2 = self.stage2(s1) 
        s3 = self.stage3(s2) 
        s4 = self.stage4(s3) 
        return s1, s2, s3, s4

class FitJourneyDecoder(nn.Module):
    def __init__(self, num_kp=17):
        super().__init__()
        self.lat4 = nn.Conv2d(384, 192, 1, bias=False)
        self.lat3 = nn.Conv2d(192, 192, 1, bias=False)
        self.lat2 = nn.Conv2d(96,  192, 1, bias=False)
        self.lat1 = nn.Conv2d(48,  192, 1, bias=False)
        self.ref3 = DepthwiseSeparable(192, 192)
        self.ref2 = DepthwiseSeparable(192, 192)
        self.ref1 = DepthwiseSeparable(192, 192)
        self.heatmap_head = nn.Sequential(
            nn.Conv2d(192, 256, 3, padding=1, bias=False),
            nn.BatchNorm2d(256),
            nn.ReLU(inplace=True),
            nn.Conv2d(256, num_kp, 1),
        )
        self.regress_head = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
            nn.Linear(192, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(0.2),
            nn.Linear(256, num_kp * 3), 
        )

    def forward(self, s1, s2, s3, s4):
        p4 = self.lat4(s4)
        p3 = self.lat3(s3) + F.interpolate(p4, size=s3.shape[-2:], mode='bilinear', align_corners=False)
        p3 = self.ref3(p3)
        p2 = self.lat2(s2) + F.interpolate(p3, size=s2.shape[-2:], mode='bilinear', align_corners=False)
        p2 = self.ref2(p2)
        p1 = self.lat1(s1) + F.interpolate(p2, size=s1.shape[-2:], mode='bilinear', align_corners=False)
        p1 = self.ref1(p1)
        heatmaps  = self.heatmap_head(p1)
        coords    = self.regress_head(p1)
        return heatmaps, coords.view(-1, 17, 3)

class FitJourneyNetV2(nn.Module):
    def __init__(self, num_kp=17):
        super().__init__()
        self.backbone = FitJourneyBackbone()
        self.decoder  = FitJourneyDecoder(num_kp)

    def forward(self, x, return_regression=False):
        s1, s2, s3, s4     = self.backbone(x)
        heatmaps, coords   = self.decoder(s1, s2, s3, s4)
        if return_regression:
            if not self.training:
                coords = torch.sigmoid(coords)
            return heatmaps, coords
        return heatmaps
