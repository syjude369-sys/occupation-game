# Occupation Game: Pattern Engine + Furniture Layout

셀 점유 시뮬레이션에서 반복되는 공간 패턴을 발견하고, 사용자가 선택한 motif를 진화 최적화에 반영한 뒤, 해당 motif에 가구 배치안을 생성하여 실제 보드 발생 위치에 도면 기호로 투영하는 건축 form-finding 실험 도구입니다.

## 바로 사용하기

- [Pattern Engine 실행](https://syjude369-sys.github.io/occupation-game/)
- [Furniture Layout Lab 실행](https://syjude369-sys.github.io/occupation-game/furniture-lab.html)
- [인터페이스 가이드](https://syjude369-sys.github.io/occupation-game/interface-guide.html)
- [GitHub 저장소](https://github.com/syjude369-sys/occupation-game)

GitHub Pages로 배포되어 있으므로 Codex 세션이나 로컬 개발 서버를 종료해도 위 링크는 계속 사용할 수 있습니다.

## 프로젝트 목표

초기에는 Grasshopper/Python 기반 게임보드 생성기를 웹으로 옮기는 작업에서 시작했습니다. 이후 목표가 승패 중심 게임에서 건축적 공간 패턴 탐색으로 바뀌면서 다음 흐름으로 발전했습니다.

```text
점유 시뮬레이션
→ 매 턴/체크포인트 보드 기록
→ 반복 패턴 발견
→ motif 등록
→ motif persistence와 recurrence 평가
→ motif 기반 세대 최적화
→ 가구 배치 대안 생성
→ 실제 motif 발생 위치에 CAD 도면 기호 overlay
```

## 개발 단계

### Phase 1. Base GameBoard

폴더: `base-gameboard`

- 직교형 N×N 보드와 플레이어 점유 시뮬레이션 구현
- void 행/열 제거와 유효 셀 판정
- 외곽 module 구조와 pivot door 표현
- 플레이어 시작점, 확장, 공격, 점유 상한 구현
- 보드 전용 WebM 녹화 및 설정 메타데이터 저장
- 기본값을 17×17 grid, module multiplier 2로 정리

### Phase 2. Territory Variant

폴더: `base-gameboard-territory`

- 원본 보존 후 별도 실험 버전 생성
- 과도하게 한쪽으로 몰리는 확장을 줄이는 territory-skip 추가
- 고정 2×2 보호 규칙을 연결된 점유 그룹 크기 기반 규칙으로 일반화

### Phase 3. Form Finding

폴더: `base-gameboard-form-finding`

- 게임의 승자 대신 최종 공간 형상을 평가하도록 전환
- seeded random search와 반복 실행 도입
- 다음 공간 지표 구현
  - Continuity
  - Multi-scale interpenetration
  - Shared boundary
  - Occupancy balance
  - Reproduction stability
- 단일 합산 점수가 아니라 Pareto frontier로 후보 보존

### Phase 4. Evolutionary Motif Lab

폴더: `base-gameboard-motif-lab`

- 세대별 archive와 lineage 구현
- elite, crossover, mutation 기반 다음 세대 생성
- `Pin parent`, `Exclude`, `Include`로 사용자 선택을 부모 풀에 반영
- motif library와 자동 discovered pattern 목록 추가
- JSON import/export와 versioned localStorage 저장 구현
- 회전/반사 동치 motif 판정과 보드 overlay 구현

이 버전은 이후 pattern engine 재작성의 보존된 기준점입니다.

### Phase 5. Pattern Engine

폴더: `base-gameboard-pattern-engine`

- 이전 버전을 보존하고 tests-first 방식으로 pattern discovery core 재작성
- 일정 간격 체크포인트와 최종 턴 검색
- Sliding Window Discovery와 Region-Based Discovery
- motif 내부의 점유 `O`와 빈칸 `E`를 정확히 보존
- 회전/반사를 canonical signature로 통합
- 외부 빈 공간과 연결되는 accessibility 검사
- 더 큰 유효 패턴 안에 포함된 작은 패턴의 nested suppression
- 내부 패턴 주변에 직교 빈칸 활로가 있으면 작은 패턴도 보존
- temporal episode, detection, duration, first/last seen 집계
- recurrence를 within-board, cross-seed, cross-genome으로 분리
- distinctiveness, symmetry, void structure 평가
- 최소 점유 칸 3개 및 motif 영역의 최소 1/3 점유 조건 적용
- Discovered 항목을 Motif Library로 승격하는 흐름 구현
- motif별 `Fitness Active`와 개별 fitness weight 추가
- motif와 discovered 목록을 duration, score, frequency 등으로 정렬

### Phase 6. Simulation Rules Version

폴더: `base-gameboard-simulation-rules`

현재 공개 배포 대상입니다.

- 기존 버전을 보존하고 새 simulation rules spec을 별도 구현
- 5×5 범위의 Rook, Bishop, Knight 이동 후보
- 접근성과 시야는 hard gate로 유지
- 거리, 응집, 공격성, 이동 모드는 연속적인 경향성으로 평가
- 최고점 후보를 선택하고 정확한 동점만 seeded random으로 결정
- Moore 8-neighbor 생존 판정
- newborn grace와 연속 실패 release delay
- 같은 턴 proposal, conflict, survival, steal, cap을 동시 적용
- extinction, fixed point, loop, max-turn 종료 상태 기록
- turn 0부터 마지막 턴까지 모든 replay frame 보존
- motif 등록 전 무작위 수집인 `Initial pattern search` 분리
- motif fitness 활성화 후 최적화하는 `Run generation` 분리
- motif fitness 활성 상태에서는 초기 패턴 검색을 비활성화
- archive별 motif 발생을 최소 3턴 이상 지속한 episode 기준으로 집계
- archive 발전 과정 재생과 WebM 저장

### Phase 7. Furniture Layout Engine

현재 공개 앱의 `Furniture Layout` 페이지에 통합되어 있습니다.

- motif의 `O/E` 구조를 가구 배치용 좌표로 정규화
- 1500 mm planning cell과 100 mm fine grid 사용
- grid-filling 자산과 partial-cell 자산을 별도로 배치
- 0/90/180/270도 회전과 제한적 mirror 후보 생성
- hard footprint 충돌과 clearance 검사
- motif 경계에 연결되는 free-space component 탐색
- 최소 900 mm circulation path 검사
- 큰 가구 우선의 lexicographic ranking
- beam search로 여러 가구 배치 대안 생성
- capacity, diversity, opening-space, path, residual-space 지표 제공
- 12개 가구 catalog와 CAD에서 추출한 SVG outline 연결
- 선택한 layout을 `Apply to Pattern Board`로 저장
- motif id 우선, signature 보조 방식으로 overlay 연결
- 보드의 임의 위치가 아니라 motif가 실제 발견된 occurrence마다 투영
- 텍스트 라벨 대신 핑크색 CAD 도면 기호로 렌더링

## 현재 사용 Workflow

1. [Pattern Engine](https://syjude369-sys.github.io/occupation-game/)을 엽니다.
2. motif fitness가 꺼진 상태에서 `Initial pattern search`를 실행합니다.
3. `Discovered`에서 의미 있는 패턴을 확인하고 motif로 등록합니다.
4. motif 카드에서 `Fitness Active`를 켜고 필요하면 개별 weight를 조절합니다.
5. `Run generation`을 실행해 해당 motif의 반복, 지속, 패턴 판독 점수가 높은 세대를 탐색합니다.
6. `Archive`에서 후보를 선택하고 `Replay`로 turn 0부터 전체 발전 과정을 봅니다.
7. 필요하면 `Save video`로 replay를 `.webm` 파일로 저장합니다.
8. motif 카드의 `→ Furniture`를 눌러 Furniture Layout Lab으로 이동합니다.
9. layout engine을 실행하고 원하는 대안의 `Apply to Pattern Board`를 누릅니다.
10. Pattern Engine으로 돌아오면 실제 motif 발생 위치에 선택한 가구 도면이 표시됩니다.

## Pattern 판독 기준

### 기본 발견 조건

- 최소 점유 칸: 3
- 최소 점유 비율: motif bounding area의 1/3
- 내부 빈칸은 `E`로 보존
- 외부 인접 빈칸은 motif 형상에 흡수하지 않음
- 접근성은 직교 연결만 인정
- 회전/반사는 동일 signature로 취급

### Pattern Fitness

- `Recurrence`: 여러 checkpoint, seed, genome에서 같은 motif episode가 반복되는 정도
- `Distinctiveness`: 주변과 구분되는 하나의 경계 패턴으로 읽히는 정도
- `Symmetry`: 회전/반사 질서와 기하학적 균형
- `Void structure`: 내부 빈 공간의 연결성, 외부 접촉, 향후 동선·가구 활용 가능성

각 항목의 weight는 UI에서 조절할 수 있습니다. Motif Library에 저장된 것만으로는 진화 점수에 들어가지 않으며, 해당 motif의 `Fitness Active`를 켜야 합니다.

## Archive와 Motif 통계

- `Detection count`: 검색 시점에 감지된 원시 횟수
- `Episode count`: 같은 위치에서 연속 체크포인트에 나타난 감지를 하나로 묶은 횟수
- `Duration steps`: motif가 관찰된 누적 지속량
- `First/Last seen`: 최초 및 마지막 발견 턴
- `Motif hits`: archive replay에서 최소 3턴 이상 연속 존속한 motif episode 수

Motifs와 Discovered 목록은 duration, score, frequency 등 선택한 값의 내림차순으로 정렬할 수 있습니다.

## Replay와 저장

- archive 후보를 선택하면 turn 0부터 종료 턴까지 모든 frame을 재생합니다.
- replay 중에도 해당 턴에 실제 존재하는 motif occurrence가 표시됩니다.
- `Save video`는 브라우저 다운로드 폴더에 WebM 파일을 저장합니다.
- Project Data의 `Export JSON`은 archive, motifs, 설정을 파일로 내보냅니다.
- `Import JSON`은 저장된 프로젝트 상태를 복원합니다.
- 브라우저 작업 상태는 versioned localStorage에 자동 저장됩니다.

주의: localStorage와 furniture overlay 선택은 브라우저와 도메인별 로컬 데이터입니다. 다른 컴퓨터나 브라우저로 옮길 때는 JSON export/import를 사용해야 합니다.

## 주요 코드 구조

```text
base-gameboard-simulation-rules/
├── index.html                         # Pattern Engine UI
├── interface-guide.html               # 인터페이스 설명
├── furniture-lab.html                 # Furniture Layout UI
├── lab-app.js                         # 메인 UI와 엔진 통합
├── simulation-rules.js                # 새 시뮬레이션 규칙
├── pattern-engine.js                  # 패턴 추출, 점수, episode
├── motif-engine.js                    # motif matching과 fitness
├── archive-motif-summary.js           # archive별 3턴 이상 motif 집계
├── optimization-mode.js               # simulation/optimization 모드 분리
├── search-mode.js                     # 실행 버튼 활성 조건
├── pattern-sort.js                    # motif/discovered 정렬
├── furniture-layout-engine.js         # 가구 배치 beam search
├── furniture-catalog.js               # 가구 metadata 검증/정규화
├── furniture-overlay.js               # motif-local layout의 보드 투영
├── recording.js                       # WebM 기록
├── storage.js                         # 저장, migration, JSON 직렬화
└── assets/furniture/                  # catalog와 CAD SVG outline
```

## 버전 보존 구조

각 주요 실험은 이전 폴더를 덮어쓰지 않고 복사본으로 보존했습니다.

```text
base-gameboard
base-gameboard-territory
base-gameboard-form-finding
base-gameboard-motif-lab
base-gameboard-pattern-engine
base-gameboard-simulation-rules
```

통합 전 백업도 `backups/`에 보관되어 있습니다.

## 로컬 실행

현재 공개 앱과 같은 버전을 로컬에서 실행하려면:

```powershell
cd "D:\3-1\디디3\DD3 Codex\base-gameboard-simulation-rules"
node server.mjs
```

기본 로컬 주소:

```text
http://127.0.0.1:5179/
```

또는 Windows에서 다음 파일을 실행할 수 있습니다.

```text
base-gameboard-simulation-rules/run-5179.cmd
base-gameboard-simulation-rules/start-5179.ps1
```

## 검증 상태

2026-06-24 기준 현재 공개 대상에서 실행한 결과:

```text
node --test *.test.mjs
tests 168
pass 168
fail 0
```

Furniture Engine 상태 검사:

```text
node codex-status.mjs
31 passed
0 failed
ALL OK
```

검증 범위에는 simulation, checkpoints, replay, pattern extraction, nested suppression, recurrence, motif fitness, sorting, storage migration, furniture catalog, placement, circulation, CAD overlay가 포함됩니다.

## 배포

`.github/workflows/pages.yml`이 `main` 브랜치의 `base-gameboard-simulation-rules` 폴더를 GitHub Pages에 배포합니다.

```text
main push
→ GitHub Actions
→ Pages artifact upload
→ https://syjude369-sys.github.io/occupation-game/
```

로컬 서버와 달리 GitHub Pages 배포본은 PC나 Codex 세션이 꺼져도 유지됩니다.

## 문서와 발표 자료

- `docs/next-session-pattern-engine-handoff.md`: pattern engine 재작성 기준
- `docs/simulation-rules/001-occupation-game-simulation-ruleset-spec.md`: 새 simulation 기준 명세
- `docs/furniture_engine_ruleset.md`: furniture solver 기준
- `docs/claude-furniture-layout-engine-handoff.md`: furniture engine 인수인계
- `docs/claude-furniture-layout-overlay-handoff.md`: furniture-to-board 연결 인수인계
- `docs/agent-collaboration-boundaries.md`: GPT, Codex, Claude 작업 경계
- `docs/patch-notes/patch-notes-through-5177.md`: 5174~5177 패치 기록
- `docs/presentation-screenshots/`: phase별 발표 이미지와 QA 기록

## 현재 한계와 후속 과제

- 가구 catalog는 현재 12개 자산 중심으로 구성되어 있어 프로그램별 자산 보강이 필요합니다.
- Furniture Layout Engine은 beam search 기반 휴리스틱으로, 수학적 전역 최적해를 보장하지 않습니다.
- CAD outline은 웹 overlay용 경량 SVG이며 Rhino/CAD로 다시 자동 배치하는 역전송은 아직 구현되지 않았습니다.
- 현재 경로 평가는 100 mm raster 기반이므로 실제 실시설계 수준의 법규 검토를 대체하지 않습니다.
- GitHub Pages는 정적 배포이므로 사용자 상태를 서버 DB에 저장하거나 여러 사용자끼리 공유하지 않습니다.
- 서로 다른 기기에서 동일 작업을 이어가려면 Project Data의 JSON export/import가 필요합니다.

