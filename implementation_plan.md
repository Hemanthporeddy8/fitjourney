# Audit Resolution Plan

This plan addresses the critical bugs and major issues identified in the team audit.

## User Review Required

> [!IMPORTANT]
> This plan involves removing unused model files and changing the networking configuration for WASM. This is necessary to fix the "forever loading" bug and optimize the project size for GitHub.

## Proposed Changes

### 1. Workout AI Fixes (Bugs #1, #2 & Issue #2)
#### [MODIFY] [workout/page.tsx](file:///d:/D%20folder%20downloads/studio-85784265/src/app/track/workout/page.tsx)
- Consolidate `initWorkoutNet` calls into a single stable hook.
- Move `setIsAiLoading(false)` to a `finally` block to prevent infinite spinners.
- Implement a 10s timeout fallback with a user-visible camera error message.
- Update `countReps` logic: Swap 'up'/'down' to 'top'/'bottom' and increase confidence threshold to `0.4`.

### 2. Networking & TypeScript (Bug #4 & Issue #5)
#### [MODIFY] [next.config.ts](file:///d:/D%20folder%20downloads/studio-85784265/next.config.ts)
- Restrict `COEP/COOP` headers to the `/models/` path instead of every route.
- Re-enable TypeScript and ESLint build checks (set to `false`).

### 3. File Cleanup (Issue #1 & DX Issue #4)
#### [DELETE] Unused models in `public/models/`
- Remove `workoutnet_v1.onnx` and `workoutnet_v1_fp16.onnx`.
- Remove redundant VisiFood versions if detected.
#### [DELETE] Duplicate data file
- Remove `src/lib/exercise-data.tsx` and ensure all imports use `exercise-data.ts`.

### 4. Security & Environment (Bug #3)
#### [NEW] [.env.local](file:///d:/D%20folder%20downloads/studio-85784265/.env.local) (Template)
- Add placeholder for `GOOGLE_GENAI_API_KEY`.
#### [MODIFY] [.gitignore](file:///d:/D%20folder%20downloads/studio-85784265/.gitignore)
- Ensure `.env.local` and bulky `.pth` files are ignored.

## Verification Plan

### Automated Tests
- `npm run build` to check for remaining TypeScript/Lint errors.
- Visual inspection of the browser console for camera permission errors.

### Manual Verification
- Test the workout page with camera permission enabled/disabled to verify the "Finally" block and error messages.
- Monitor the network tab to ensure external fonts/images load (checking COEP fix).
