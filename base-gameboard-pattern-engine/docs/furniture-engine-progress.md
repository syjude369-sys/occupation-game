# Furniture Layout Engine — Progress Report
> 2026-06-22

## 완료

### 1. furniture-layout-engine.js (전면 재작성)
- 기존 greedy row-major → **beam search** (beamWidth=50)
- **Fine grid** FINE_GRID_MM=100, CELL_SIZE_MM=1500 (동결)
- Fine grid 값: FG_EXTERIOR=0, FG_O=1, FG_E=2, FG_BLOCKED=3, FG_CLEARANCE=4
- **배치 분류**: grid-filling (1500mm 스냅, O셀 전용) / partial-cell (100mm 스냅, 8 edge alignment)
- **Ranking**: primarySizeSequence (lexicographic) → diversityScore → capacity → openingSpaceScore
- **중복 제거**: Jaccard similarity, threshold=0.75
- **Access direction**: rot=0 front=S / rot=90 front=W / mirror E↔W flip
- E셀 = 식물 전용, O셀 = 가구+식물

주요 export:
```
CELL_SIZE_MM, FINE_GRID_MM, MIN_PATH_WIDTH_MM, PREFERRED_PATH_WIDTH_MM
normalizeMotifForFurniture, buildFineGrid, discoverFreeComponents
generateGridFillingCandidates, generatePartialCellCandidates
validateLayout, generateFurnitureLayouts
```

### 2. furniture-catalog.js
normalization 에 3 필드 추가:
```js
repeatable: item.repeatable ?? true,
maxCopies: item.maxCopies ?? null,
allowsMirror: item.allowsMirror ?? false,
```

### 3. furniture-catalog.json
`office_cubicle` clearance: front only (1500mm). back 제거.

### 4. furniture-svg-outlines.json
Rhino IronPython으로 CAD 블록 윤곽 추출 (53KB).
- 12개 블록, [0,1]×[0,1] normalized, top 40 curves by length
- Y-flip: `translate(0,1) scale(1,-1)` (Rhino Y-up → SVG Y-down)
- 경로: `assets/furniture/metadata/furniture-svg-outlines.json`

### 5. furniture-lab.html (신규)
- 웹 기반 레이아웃 테스트 UI
- 그리드 에디터 (O/E/0 셀 페인팅)
- furniture-layout-engine.js 직접 호출 (ES module)
- **CAD 윤곽 렌더링**: SVG path + transform pipeline
  ```
  translate(x,y) translate(ew/2,ed/2) rotate(rot) translate(-fw/2,-fd/2)
  scale(fw,fd) translate(0,1) scale(1,-1) [mirrorX]
  ```
- URL param `?motif=` 으로 Pattern Engine에서 모티프 자동 로드

### 6. Pattern Engine 통합
- `lab-app.js`: 모티프 카드에 "→ Furniture" 버튼 추가
- `index.html`: `nav.appnav` 추가 (Pattern Engine 탭 active)
- `furniture-lab.html`: `nav.appnav` 추가 (Furniture Layout 탭 active)
- `style.css`: `nav.appnav` 스타일 추가 (공유)
- 두 페이지가 하나의 프로그램처럼 동작

### 7. 테스트
`furniture-layout-engine.test.mjs` — 44 tests, all pass
```
node --experimental-vm-modules node_modules/.bin/jest furniture-layout-engine
```

---

## 미완 / 추후

- [ ] 가구 카탈로그 실 데이터 보강 (현재 샘플 수준)
- [ ] partial-cell landscape placement (식물 E셀 배치 로직 세분화)
- [ ] layout 결과 → Rhino 역전송 (블록 인스턴스 자동 배치)
- [ ] 다중 모티프 배치 비교 UI

---

## 파일 위치

```
base-gameboard-pattern-engine/
├── furniture-layout-engine.js          ← 엔진 본체
├── furniture-layout-engine.test.mjs    ← 테스트
├── furniture-catalog.js                ← 카탈로그 파서
├── furniture-lab.html                  ← 웹 UI
├── lab-app.js                          ← Pattern Engine (→ Furniture 버튼)
├── index.html                          ← Pattern Engine Lab (nav 추가됨)
├── style.css                           ← 공유 nav 스타일
└── assets/furniture/
    ├── metadata/furniture-catalog.json
    └── metadata/furniture-svg-outlines.json
```
