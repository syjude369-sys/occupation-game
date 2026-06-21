# Metric Handbook Office Reference — Claude Handoff

## 0. 목적

이 문서는 `Occupation Game`의 가구배치 룰셋을 정리할 때 사용할 **Metric Handbook 오피스 관련 핵심 자료만 추려놓은 인수인계 문서**다.

Claude가 책 전체를 읽으며 토큰을 낭비하지 않도록, 아래 지정 페이지만 우선 확인한다.

---

## 1. 원본 문서 경로

### PDF

```text
/mnt/data/Pamela_Buxton_(Editor)_-_Metric_Handbook__Planning_and_Design_Data-Routledge_(2018).pdf
```

동일 파일의 다른 업로드본이 있을 수 있으나, 위 경로를 기준으로 사용한다.

### 직접 확인할 PDF 페이지

```text
PDF page 573 → printed page 30-10
PDF page 574 → printed page 30-11
PDF page 575 → printed page 30-12
PDF page 576 → printed page 30-13
```

### 페이지 이미지 경로

```text
/mnt/data/office_page_573.png
/mnt/data/office_page_574.png
/mnt/data/office_page_575.png
/mnt/data/office_page_576.png
```

도면 치수와 가구 배치 형상을 볼 때는 PDF 전체를 열지 말고 위 PNG를 직접 확인한다.

---

# 2. 이 자료를 사용하는 방식

Metric Handbook는 다음을 제공하는 **설계 기준 자료**로 사용한다.

- 공간 유형
- 대표적인 방 크기
- 가구 수용 인원
- 가구 간격
- 통행 및 접근 여유
- 수납·복사·서비스 공간 크기
- 오피스 배치 유형

이 책의 도면을 그대로 CAD 자산으로 취급하지 않는다.

실제 가구엔진에서는 다음과 같이 나눈다.

```text
Metric Handbook
→ 치수·여유·배치 원칙

CAD / 3dm / SVG / DXF 자산
→ 실제 가구 형상

JSON metadata
→ 가구 의미, 회전 가능성, 접근면, clearance
```

---

# 3. 현재 프로젝트의 공통 그리드

현재 Occupation Game의 기본 공간 단위:

```text
1 cell = 1500 mm × 1500 mm
1 cell area = 2.25 m²
```

Metric Handbook의 공간을 이 그리드에 맞추어 해석한다.

단, 가구 자체를 1500 mm 단위로만 배치하면 너무 거칠다.

가구엔진 내부 배치 해상도는 이후 다음 중 하나를 사용한다.

```text
50 mm
100 mm
```

1500 mm 셀은 패턴 경계와 프로그램 영역의 단위이고, 실제 가구·통로 검증은 더 세밀한 해상도로 수행한다.

---

# 4. Office Chapter 핵심 개념

## 4.1 오피스 배치 원칙

Printed page `30-10`, PDF page `573`.

오피스 배치는 다음을 동시에 만족해야 한다.

- 커뮤니케이션
- 조용하고 집중적인 작업
- 팀 및 프로젝트 작업
- 비밀·개인 작업
- 자연광
- 조망
- 환기
- 시간대에 따른 유연한 사용

즉, 가구엔진은 단순히 책상을 최대한 많이 넣는 방식으로 평가하면 안 된다.

```text
capacity
+ circulation
+ privacy
+ collaboration
+ diversity of settings
```

을 함께 고려해야 한다.

---

## 4.2 대표 오피스 유형과 밀도

Printed page `30-10`, PDF page `573`.

### Highly cellular layout

```text
253 desks
NIA 9.7 m² / desk
```

### 90/10 open plan / cellular layout

```text
237 desks
NIA 10.3 m² / desk
```

### Open plan layout

```text
233 desks
68 other settings
NIA 10.5 m² / desk
NIA 8.1 m² / person
```

이 수치는 motif 하나의 직접 배치 기준이라기보다, 여러 motif가 모인 전체 오피스 결과의 밀도 검증에 사용할 수 있다.

---

# 5. Formal Meeting Rooms

Printed page `30-11`, PDF page `574`, Figure `30.15`.

모든 치수는 mm.

| Type | Capacity / Use | Dimensions | 1500-grid interpretation |
|---|---:|---:|---|
| A | 4 seats | 3000 × 3000 | 2 × 2 cells |
| B | 6 seats | 3000 × 4500 | 2 × 3 cells |
| C | 8 seats | 4500 × 4500 | 3 × 3 cells |
| D | 10 seats | 4500 × 6000 | 3 × 4 cells |
| E | 12-seat presentation | 6000 × 6000 | 4 × 4 cells |
| F | 12-seat presentation | 6000 × 6000 | 4 × 4 cells |
| G | 36-seat presentation | 9000 × 6000 | 6 × 4 cells |
| H | Teleconference room | 9500 × 7500 | approximately 6.33 × 5 cells |

### 프로젝트 적용

A–G는 현재 1500-grid와 정확히 맞는다.

따라서 초기 furniture-set template로 바로 만들 수 있다.

예:

```text
meeting_04 = 2×2 cells
meeting_06 = 2×3 cells
meeting_08 = 3×3 cells
meeting_10 = 3×4 cells
meeting_12 = 4×4 cells
presentation_36 = 6×4 cells
```

단, 실제 출입 위치와 내부 의자 인출 여유는 세부 가구배치 단계에서 검증한다.

---

# 6. Informal Meeting and Breakout Areas

Printed page `30-11`, PDF page `574`, Figure `30.16`.

모든 치수는 mm.

| Type | Use | Dimensions | 1500-grid interpretation |
|---|---|---:|---|
| A | 2 seats | 1500 × 2250 | 1 × 1.5 cells |
| B | 4 seats | 3000 × 3000 | 2 × 2 cells |
| C | 4 seats | 3000 × 3000 | 2 × 2 cells |
| D | 4 seats | 3000 × 3000 | 2 × 2 cells |
| E | Team presentation | 4500 × 4500 | 3 × 3 cells |
| F | Breakout | 4500 × 4500 | 3 × 3 cells |
| G | Banquette booth | 3000 × 3000 | 2 × 2 cells |
| H | High-backed seating | 3000 × 3000 | 2 × 2 cells |
| I | Open banquette | 3000 × 3000 | 2 × 2 cells |
| J | Breakout lounge | 6000 × 4000 | 4 × 2.67 cells |

### 프로젝트 적용

Informal set는 같은 면적이라도 다른 배치 성격을 가진다.

예:

```text
3000 × 3000
→ 4-seat round table
→ wall-side banquette
→ high-backed booth
→ open lounge
```

따라서 가구엔진은 `room size = program`으로 단정하면 안 된다.

같은 motif에 대해 여러 furniture-set alternative를 돌려야 한다.

---

# 7. Bench Seating

Printed page `30-12`, PDF page `575`, Figure `30.17`.

핵심 치수:

```text
workstation pitch along bench = 900 mm
clear spacing between facing bench groups = approximately 2200–2400 mm
```

### 프로젝트 적용

1500 mm 셀 하나에 900 mm 폭 workstation 하나를 배치하고 남는 폭을 다음에 사용할 수 있다.

```text
circulation
small storage
planter edge
shared equipment
```

다만 남는 폭이 자동으로 유효 통로가 되는 것은 아니다.

가구엔진은 실제 clear width를 별도로 검증해야 한다.

---

# 8. Focus Room

Printed page `30-12`, PDF page `575`, Figure `30.18`.

```text
1500 × 3000 mm
```

1500-grid:

```text
1 × 2 cells
```

### 프로젝트 적용

집중실 또는 1인 독립 업무실의 기본 furniture-set으로 사용할 수 있다.

```text
focus_room_01
footprint = 1500 × 3000
capacity = 1
```

---

# 9. Touchdown Areas

Printed page `30-12`, PDF page `575`, Figure `30.19`.

## 4-seat touchdown

```text
2250 × 3000 mm
```

## 8-seat touchdown

```text
2250 × 6000 mm
```

1500-grid 해석:

```text
4-seat = 1.5 × 2 cells
8-seat = 1.5 × 4 cells
```

### 프로젝트 적용

이 규격은 1500-grid에 정확히 맞지 않는다.

따라서 두 가지 방식 중 하나를 사용한다.

```text
A. 1500-grid 영역 안에서 finer-resolution 배치
B. 필요한 motif cell 수를 올림하여 배치 후 남는 공간을 buffer / planting으로 처리
```

예:

```text
2250 × 3000
→ 2 × 2 cells 안에 배치
→ 남는 750 mm strip은 storage / planting / buffer 후보
```

---

# 10. Storage Access and Circulation

Printed page `30-13`, PDF page `576`, Figure `30.20a–c`.

## Lateral filing unit

도면상 핵심 값:

```text
filing depth ≈ 420 mm
working / access zone ≈ 800 mm
overall planning strip ≈ 2000 mm
```

## Filing banks facing a circulation zone

```text
storage depth = 500 mm each side
clear circulation between storage = 1500 mm
```

## Additional illustrated clearances

Figure 30.20c에는 다음 대표값이 제시된다.

```text
500 mm storage depth
900 mm clearance
1000 mm low storage block
1100 mm access zone
1500 mm circulation / working zone
```

### 프로젝트 적용

수납은 단순 footprint만으로 검증하면 안 된다.

가구 metadata에는 최소한 다음이 필요하다.

```js
{
  footprint,
  accessSide,
  doorOrDrawerClearance,
  workingClearance,
  wallRequired
}
```

예:

```text
lateral filing
→ wall preferred
→ front access required
→ approximately 800–1100 mm access
```

마주 보는 수납 사이를 실제 통로로 사용할 경우:

```text
clear width ≈ 1500 mm
```

을 초기 템플릿 기준으로 사용할 수 있다.

---

# 11. Copy and Vending Areas

Printed page `30-13`, PDF page `576`, Figure `30.21`.

## Copy area

```text
3000 × 4500 mm
```

1500-grid:

```text
2 × 3 cells
```

## Copy and vending area

```text
3000 × 6000 mm
```

1500-grid:

```text
2 × 4 cells
```

### 프로젝트 적용

서비스 공간 furniture-set:

```text
copy_area = 2×3 cells
copy_vending_area = 2×4 cells
```

내부에는 다음을 별도로 검증한다.

- 기기 footprint
- 기기 전면 조작 영역
- 대기 영역
- 수납
- 폐기물
- 통행 간섭

---

# 12. Servicing Strategy

Printed page `30-12`–`30-13`, PDF page `575`–`576`.

오피스 전원·통신 공급 방식:

```text
raised floor
perimeter ducting
```

Raised floor는 유연성을 제공하지만, floor outlet box가 가구와 주요 동선에 간섭할 수 있다.

### 프로젝트 적용

초기 furniture solver에는 서비스 인프라를 완전 구현하지 않아도 된다.

하지만 향후 furniture metadata 또는 board metadata에 다음 필드를 둘 수 있다.

```js
{
  powerAccessRequired: true,
  preferredServiceZone: "floor" | "perimeter" | "either"
}
```

서비스 가구와 업무 좌석 배치 시 전원 접근성을 후속 점수로 추가할 수 있다.

---

# 13. Furniture Engine에서 사용할 초기 공간 템플릿

Metric Handbook 기반 초기 template 후보:

## Work

```text
focus_room_01
touchdown_04
touchdown_08
bench_workstation
```

## Meeting / Collaboration

```text
formal_meeting_04
formal_meeting_06
formal_meeting_08
formal_meeting_10
formal_meeting_12
presentation_12
presentation_36
informal_meeting_02
informal_meeting_04
team_presentation
breakout_small
breakout_large
banquette_booth
high_backed_booth
```

## Storage

```text
lateral_filing_single
lateral_filing_double_bank
tall_storage
low_storage
locker_or_shelving
```

## Service

```text
copy_area
copy_vending_area
```

## Planting

Metric Handbook의 해당 페이지는 식재 도면을 직접 제공하지 않는다.

식재는 다음 룰에 따라 별도 자산으로 정의한다.

```text
motif 내부 empty cell만 자동 식재 후보
circulation clear width를 침범하지 않음
enclosed internal void는 planted court / tree 후보
fragmented pocket은 planter 후보
```

---

# 14. Motif와 Furniture의 연결 원칙

## Raw motif

패턴 탐색에서 발견된 원본:

```text
occupied cells
+ initially included empty cells
```

## Furniture interpretation

가구배치 결과:

```text
program
furniture set
entrance
internal path
clearance
planting
service
score
```

가구엔진은 원본 motif를 수정하지 않는다.

외부 인접 공백을 자동으로 추가하지 않는다.

내부 empty cell은 다음으로 해석될 수 있다.

```text
path
buffer
planting
court
unassigned
```

---

# 15. Claude에게 요청할 작업 범위

Claude는 우선 다음만 수행한다.

1. 이 문서를 읽는다.
2. 지정된 PDF page 573–576 또는 PNG 네 장만 확인한다.
3. 가구배치 룰셋을 정의한다.
4. 치수와 clearances를 JSON schema로 변환한다.
5. furniture-set template를 정의한다.
6. motif 내부에서의 배치 성공 조건을 정의한다.
7. 내부 통로와 식재 판단 규칙을 정의한다.
8. 결과를 다음 파일로 작성한다.

```text
furniture_engine_ruleset.md
```

책 전체를 다시 탐색하지 않는다.

추가 자료가 필요할 경우, 먼저 필요한 항목과 이유를 명시한 뒤 해당 페이지만 추가로 탐색한다.

---

# 16. Claude에게 그대로 전달할 짧은 프롬프트

```text
아래 인수인계 문서를 기준으로 Occupation Game의 furniture engine ruleset을 정리해줘.

먼저 이 파일을 읽어:
- /mnt/data/metric_handbook_office_reference_for_claude.md

Metric Handbook 원본은:
- /mnt/data/Pamela_Buxton_(Editor)_-_Metric_Handbook__Planning_and_Design_Data-Routledge_(2018).pdf

불필요하게 책 전체를 읽지 말고 PDF page 573–576만 확인해.
도면을 빠르게 볼 때는 아래 이미지만 사용해:
- /mnt/data/office_page_573.png
- /mnt/data/office_page_574.png
- /mnt/data/office_page_575.png
- /mnt/data/office_page_576.png

프로젝트 전체 워크플로우는:
- /mnt/data/occupation_game_multi_page_workflow_handoff.md

패턴 탐색 명세는:
- /mnt/data/codex_pattern_discovery_patch_brief.md

이번 작업 범위는 furniture engine ruleset 정리이며, 결과를 다음 파일로 작성해:
- furniture_engine_ruleset.md

Metric Handbook는 치수·clearance·배치 원칙의 근거로 사용하고, 도면 자체를 CAD asset으로 취급하지 마.
가구의 실제 배치는 deterministic geometry solver가 수행하도록 설계하고, LLM이 개별 좌표를 직접 생성하게 하지 마.
```
