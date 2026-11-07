# docatlas 구현 계획

문서 기준: 2026-11-08.
[요구사항](./REQUIREMENTS.md) · [설계](./DESIGN.md) · [수동 검증](./MANUAL_TEST_CHECKLIST.md)

## 현재 상태와 작업 순서

- 현재 작업(2026-11-08): RQ-33~37 구현·자동/합성 검증 완료. 계획 커밋 `09fd3e8` 뒤 designer 1.3.1과
  선택 maintainer 1.0.0을 kit 1.5.0으로 구현했다. 실제 클라이언트 인수와 게시는 별도다.
- 완료: 독립 패키지 뼈대, 공개 저장소, 도움말·버전 CLI, 초기 패키징 검증.
- 완료: Phase 1 문서 수집 API, 기능 계층, 선택 설정과 자동 검증.
- 완료: Phase 2 CLI·로컬 서버·카드 지도·Markdown source 표시.
- 완료: Phase 3 Markdown 서식/원문·목차·상대 참조·이미지·탐색 복원.
- 완료: Phase 4 검색·변경 감지·명시적인 문서 이동 연결과 현재 탐색 보존.
- 기본 실행 정책: 터미널에서 서버 유지, Ctrl+C로 종료.
- 완료: Phase 5 Test Hardening. Node 93개·Chrome 34개와 F-08 성능 측정·회귀 기준 기록.
- 진행 중: Phase 6 Integration Test. 별도 설치 자동 검증은 Node 22.12.0·24.22.1에서 통과했다.
  전체 수동 인수·선언한 Node 22.0·최종 지원 OS 검증은 남아 있다.
- 완료: 0.2.0의 추가 수집 옵션·설정 파일명·검색 경로 탐색을 사용자가 npm 배포했다.
  Python·Java 기본 제외와 에이전트 스킬 설치를 포함한 0.3.0도 사용자가 게시했다. 맨 아래 현재 인계가 최신 상태다.
- 완료: 검색 결과의 경로에서 트리 위치 찾기. 최신 문법 51개·Chrome 40개·설치 통합 4개 통과.
- 완료: RQ-16·17·18 에이전트 스킬 관리와 설치의 구현·자동 검증·Windows/macOS CI·Claude Code 실제 세션 확인과 PR #1 병합.
  Codex 실제 세션 확인과 남은 수동 인수는 별도다. 0.3.0은 사용자가 npm에 게시했다(2026-10-28 registry latest 확인).
- 완료: RQ-19 저장소 소개와 DDD 본거지 문서와 이전 인계 정리. 제품 코드는 바꾸지 않았다. M-18 사람 확인은 남아 있다.
- 완료: DC-21 METHOD 한국어판과 examples/ 합성 예제 프로젝트. M-18 사람 확인은 남아 있다.
- 완료: DC-28 기본 설치 항목을 designer·implementer·reviewer 세 쌍으로 변경. 0.4.0으로 게시했다.
- 완료: DC-29 문서 위치 원칙을 METHOD 두 언어판과 designer 스킬 1.2.0(kit 1.1.0)에 반영. 0.4.1로 게시했다.
- 완료: RQ-20·DC-30 구현 계획의 Refs·Files 표기. METHOD 두 언어판과 kit 1.2.0(designer 1.3.0·implementer 1.2.0·reviewer 1.5.0).
  0.4.2로 게시했다.
- 완료: RQ-21·DC-31 npm 게시 자동화. 0.4.2를 v0.4.2 태그 푸시로 GitHub Actions가 Trusted Publishing으로 게시했다.
- 완료(2026-11-03, 0.6.0 게시): RQ-24~29 선택 백업 스킬/룰과 private-cloud 보조 명령. 전체/선택 경로, 이름/태그/ID, 새 PC 복구, 상태/잠금을 구현했다.
- 자동 검증 완료: 문법 92개·kit 1.4.0 다섯 쌍, Node 231개, production tarball 통합 7개와 독립 에이전트 합성 왕복. 실제 클라우드 앱·Windows 콘솔·일반 작업의 에이전트 인수는 남아 있다. Windows/macOS CLI·브라우저 CI는 통과했다.
- 확정 정책: 클라우드는 명시적 요청에만 실행하고 일반 작업에서 권유하지 않는다. 기존 네 쌍과 기본 세 쌍, 로컬 phase 백업은 유지한다.
- 프로토타입 구현·자동 회귀 완료(2026-11-04): RQ-30·31 관련 파일 표시와 왼쪽 파일명 검색.
  기준 4종 문서를 사후 동기화했다. Node 236개·Chrome 48개 통과이며 추가 Test Hardening·원격 플랫폼·최종 UX는 남아 있다.
  후속 요청으로 0.7.0을 main에 커밋·푸시했고, 이어 태그 푸시·실제 게시까지 승인받았다. Lithent/ftags 검토(DC-49)는 전환 구현과 구분한다.
- 후속 완료: RQ-32/DC-50 UI 번들링·최소화, esbuild 없는 일반 production-only 설치와 통합 8개 통과.
  현재 pack은 61파일·압축 100,227·해제 342,299바이트다.

기술 선택은 각 단계에서 근거와 검증을 기록해 DC/IC를 해소한다.
상세 계약을 바꾸면 요구사항·설계·단계·수동 기준을 같은 작업에서 갱신한다.
미구현 명령이나 테스트 스크립트를 이미 사용할 수 있는 것으로 안내하지 않는다.

## Phase 0 — 공개 프로젝트 부트스트랩: 완료

- [x] 독립 package manifest와 CLI 실행 진입점.
- [x] README, AGENTS.md와 기준 4종 문서.
- [x] 문법·CLI·문서 링크·tarball 설치 검사.
- [x] 공개 GitHub 저장소와 main 초기 push.

기준 검증: npm run check, help/version/잘못된 인자, npm pack과 별도 설치.
종료 기준: 공개 main에서 문서와 실행 가능한 뼈대를 확인한다.
검증 결과는 아래 기존 이력을 따른다.

## 계획 문서 구체화 — 완료

- [x] 확인된 요구와 설계 제안, 현재 구현 상태를 구분한다.
- [x] 독립 CLI·카드·4종 문서·Markdown 읽기의 인수 기준을 연결한다.
- [x] 포그라운드 실행과 Ctrl+C 종료라는 사용자 선택을 반영한다.
- [x] 발견·계층·설명·설정·CLI·링크의 구체적인 초안을 작성한다.
- [x] 단계별 기준 테스트와 종료 기준을 작성한다.
- [x] Test Hardening과 Integration Test를 별도 단계로 둔다.
- [x] 상대 링크·식별자·4종 문서 정합성을 검사한다.

기준 검증: 문서 링크와 RQ/PR/DC/IC/M 참조, 사용자 선택과 현재 코드의 구분.
종료 기준: 기준 4종이 모순 없이 연결되고 남은 결정의 해소 단계가 분명하다.

## Phase 1 — 문서 수집기와 계층: 완료

대응: RQ-01·03·05, PR-03·07 / DC-04·05, IC-01.

- [x] F-01~03의 가상 문서 프로젝트와 예상 인덱스를 작성한다.
- [x] 테스트 실행 명령을 정하고 수집기 기준 테스트를 함께 추가한다.
- [x] 기본 발견, 제외·ignore 우선순위와 경로 경계를 확정한다.
- [x] docs 안의 Markdown과 docs 밖의 표준 문서를 발견한다.
- [x] 원본 경로로 문서 종류와 그룹 id를 정한다.
- [x] 상위 자체 문서·하위 기능·구조 그룹을 구성한다.
- [x] 제목·설명 추출과 선택 설정의 첫 계약을 구현한다.
- [x] 읽기 실패·빈 결과·잘못된 설정을 구분한다.
- [x] 수집기가 화면과 서버 없이 테스트되도록 모듈을 분리한다.

기준 테스트: F-01의 발견 문서 8개와 관계, 부분 4종, README, 한글·공백,
동명 그룹, docs 밖의 표준 문서, 제외 경로, 일관된 정렬, 설정 오류.
경로 경계는 가상 루트 밖의 더미 파일로 검증한다.

종료 기준: 같은 입력에서 같은 지도 모델을 만들고 M-01·02·09·13·14의 수집
조건을 자동 검증한다. DC-04·05의 구현 계약과 근거가 설계에 기록되어야 한다.

## Phase 2 — 포그라운드 서버와 문서 지도: 완료

대응: RQ-02·04·05·08, PR-01·06 / DC-06·08, IC-02·03.

- [x] 화면 도구·빌드 방식과 계획된 CLI 옵션을 확정한다.
- [x] cwd 기본 루트와 --root를 처리한다.
- [x] loopback 서버, 사용 가능한 포트, 준비 완료 안내를 구현한다.
- [x] 브라우저 열기와 --no-open을 구현한다.
- [x] 가로 카드·설명·하위 그룹·문서 선택 항목을 표시한다.
- [x] 화살표·카드 본문·문서 항목의 동작을 구분한다.
- [x] 서버는 터미널에서 유지하고 Ctrl+C로 자신의 자원을 정리한다.
- [x] 여러 실행의 루트와 종료 대상을 구분한다.
- [x] 문서 0개·설정 오류·브라우저 실행 실패 상태를 안내한다.

기준 테스트: 다른 cwd/명시 루트, 준비 전 브라우저 접근 방지, 두 서버의 루트
분리, 한 서버 종료가 다른 서버에 미치는 영향, 신호 정리, 긴 제목, 키보드 탐색.

종료 기준: CLI로 지도를 열어 디스크의 실제 문서 목록을 선택하고 정상 종료한다.
이 단계의 본문 표시가 미완성이라면 현재 상태를 명확히 안내한다.
M-03·08과 M-12·14의 실행 조건을 확인한다.

## Phase 3 — Markdown 읽기와 링크: 완료

대응: RQ-06, PR-01·04 / DC-06·07, IC-01.

- [x] Markdown·제목 앵커·HTML 처리·이미지 허용 범위를 확정한다.
- [x] 선택 문서를 렌더링하고 지도와 본문의 위치를 분리한다.
- [x] 표·코드·목차와 긴 콘텐츠를 처리한다.
- [x] 상대 Markdown 링크·앵커·이미지를 원본 위치 기준으로 해석한다.
- [x] 문서 간 이동과 뒤로 가기, 현재 선택 표시를 연결한다.
- [x] 수집 범위 밖·없음·제외됨·코드 링크를 구분한다.
- [x] 좁은 화면의 지도/본문 전환과 키보드 포커스를 검토한다.

기준 테스트: F-04의 한글·공백 링크, 앵커·표·코드, 삭제된 대상,
프로젝트 밖 참조와 지원하지 않는 프로토콜. 렌더링 정책을 실제 브라우저에서도 확인한다.

종료 기준: M-03·04·06·13·15로 탐색 → 문서 선택 → 읽기 → 관련 문서 이동을
재현한다. RQ-01~06·08을 충족하는 첫 사용 가능 단계이며 전체 배포 완료는 아니다.

## Phase 4 — 검색·변경 반영·이동 문서: 완료

대응: PR-02·05·08, PR-06의 탐색 상태 / DC-09, IC-03.

- [x] 검색 필드·정렬·일치 문맥과 갱신 계약을 확정한다.
- [x] 기능명·문서명·경로·본문의 한글/영문 검색을 구현한다.
- [x] 문서 수정·추가·삭제로 스냅샷을 갱신한다.
- [x] 문서 선택·읽기 위치와 삭제 안내를 유지한다.
- [x] 설정에 명시한 이전 경로를 현재 문서로 연결한다.
- [x] 이동 연결의 순환·없는 대상·오탐을 처리한다.
- [x] 열린 프로젝트·탭 사이의 탐색 상태를 분리한다.

기준 테스트: F-05의 이동 연결, F-06의 두 프로젝트, 저장 이벤트 연속 발생,
선택 문서 삭제, 갱신 전후 검색 결과와 오류 복구.

종료 기준: M-05·07·10을 만족하고 수집기·지도·뷰어 회귀를 통과한다.
기존 문서의 내용만으로 이동을 임의 판단하지 않는다.

## Phase 5 — Test Hardening: 완료

대응: 구현된 전체 요구사항과 결정.

이번 보강: 감지기 시작/교체 중 종료와 오류, 열린 SSE의 종료, 제외/심볼릭 링크 경계,
긴 한글 경로·동명 문서·큰 표·키보드 포커스를 재현한다. F-08의 생성기와 반복 측정 명령을
남기고 수집/검색/저장 반영/유휴 CPU/메모리를 측정한 다음 로컬 회귀 기준을 정한다.

- [x] 각 이전 단계의 회귀를 실행하고 새 실패 경로를 보강한다.
- [x] 빈 폴더·읽기 실패·잘못된 설정·중복 제목·긴 경로.
- [x] 경로 정규화·심볼릭 링크·허용 범위 밖 파일.
- [x] 반복 시작·종료·감지기/타이머 정리·브라우저 실행 실패.
- [x] 한글·공백·큰 표·좁은 화면·키보드와 포커스 표시.
- [x] F-08 300개 문서에서 수집·검색·갱신을 측정한다.
- [x] 측정 환경·시간·메모리와 채택할 성능 기준을 기록한다.

기준 테스트: 이전 단계의 전체 회귀와 F-02~06·08의 경계 예제.
통과한 검사를 이유 없이 반복하기보다 새 변경과 남은 문제에 필요한 검증을 선택한다.

종료 기준: 주요 실패 경로에 재현 가능한 검증이 있고 남은 결함의 처리 방침이 있다.
성능 기준은 측정 후 확정하며 문서 개수를 지원 상한으로 오해하게 하지 않는다.

## Phase 6 — Integration Test: 자동 검증 완료·인수 진행 중

대응: RQ-01·02·08과 전체 사용자 흐름.

2026-10-28 재개: npm run test:integration에 F-07의 설치·화면·다중 실행·원본 해시 비교를
재현 가능하게 묶는다. 설치는 production-only/offline이며 DOCMAP_NPM_CACHE로 캐시를 지정한다.
이 자동 검증의 성공과 지원 환경·사람의 수동 인수 완료를 구분한다.

- [x] 실제 tarball을 별도 임시 설치 위치에 설치한다.
- [x] F-07의 JavaScript/비 JavaScript 가상 프로젝트를 실행한다.
- [x] 설치 위치·cwd·--root가 달라도 올바른 문서를 읽는다.
- [x] 카드 → 4종 문서 → Markdown → 링크 → 원본 저장 → 갱신을 확인한다.
- [x] 두 실행 중 하나만 Ctrl+C에 해당하는 SIGINT로 종료하고 나머지의 갱신을 확인한다.
- [x] npm 패키지에 화면·런타임 자산이 실제 포함되는지 검사한다.
- [x] 대상 프로젝트 원본과 설정에 의도하지 않은 쓰기가 없는지 확인한다.
- [ ] 지원할 최소 Node와 OS의 검증 결과를 기록한다.
  현재 macOS 15.6.1 / Node 22.12.0·24.22.1 통과. 선언한 22.0·최종 지원 OS는 미검증/TBD다.
- [ ] M-01~15의 남은 수동 인수를 수행하고 최종 결과를 기록한다.

기준 테스트: F-07의 설치 tarball로 실행한 실제 CLI/브라우저 검증과 M-01~15.
소스 저장소 안에서만 동작하는 결과를 설치 성공으로 간주하지 않는다.

종료 기준: 합의된 제품 범위의 모든 필수 M 항목이 pass이고 설치 위치와 무관하게
핵심 흐름이 재현된다. 제안 기능을 제외하면 4종 문서도 같은 범위로 정리한다.

## Phase 7 — 배포 준비

대응: DC-10과 설치·배포 계약.

- [x] 사용자 선택: MIT·npm docatlas·GitHub superlucky84/docatlas. 레지스트리 등록 여부는 배포 직전 다시 확인한다.
- [ ] 실제 검증된 최소 Node·지원 OS를 문서화한다.
- [ ] 구현된 명령과 설정으로 README·도움말·예제를 정리한다.
- [ ] 확정한 환경에서 CI와 패키지 검사를 구성한다.
- [ ] 배포할 버전·파일 목록·검증 결과를 정리한다.
- [ ] 확정된 배포 대상에 릴리스한다.

기준 테스트: 공개 예정 tarball의 설치·실행과 필수 인수 항목.
종료 기준: 라이선스와 배포 대상이 확정되고 실제 설치 가능한 릴리스가 있다.
GitHub 초기 생성은 이 단계의 npm 배포를 대신하지 않는다.

## 프로젝트별 설치와 docmap 명령 — 완료

2026-10-28 사용자 요청. 대응: RQ-09 / DC-11 / M-08·11.

- [x] 기준 4종에 프로젝트별 개발 의존성 설치·명령 이름·로컬 PATH의 실행 계약을 기록한다.
- [x] docmap bin을 추가하고 ddd-docmap 호환 이름과 같은 CLI로 연결한다.
- [x] 도움말·오류 안내·README의 설치와 실행 예제를 갱신한다.
- [x] Test Hardening: 두 이름의 도움말·버전·잘못된 인자·로컬 명령 발견을 검증한다.
- [x] 회귀 중 확인한 테스트 정리 순서를 보강한다. 테스트 임시 루트를 삭제하기 전에
  서버·감지기를 먼저 닫아 부모 임시 디렉터리 polling이 남는 경합을 방지한다.
- [x] Integration Test: 실제 tarball을 JS 대상의 개발 의존성으로 설치하고 .bin/docmap으로
  cwd 수집·읽기·갱신·신호 종료와 설치 이후 원본 보존을 검증한다.
- [x] npm run check, npm test, npm run test:integration, npm pack --dry-run과 문서 정합성을 확인한다.

기준 테스트: Node 93개, 기존 설치 통합 4개, public bin ddd-docmap의 이전 동작.
종료 기준: 로컬 설치가 docmap과 호환 명령을 제공하고 해당 프로젝트의 문서를 읽는다.
사용자는 npx docmap / pnpm docmap을 선택했다. 전역 런처/PATH 자동 변경은 추가하지 않는다.
실제 대상 프로젝트 설치는 별도 실행 단계다.

검증 기록: npm run check의 JavaScript 47개, npm test의 Node 93개와 설치 통합 4개가 통과했다.
통합 테스트는 docmap/ddd-docmap의 npm exec 도움말·버전, npm run docmap,
알 수 없는 인자의 종료 2, JS 대상의 실제 개발 의존성 설치와 .bin/docmap의 cwd 실행을 확인한다.
브라우저의 읽기·검색·갱신·SIGINT 종료·다른 실행 유지와 설치 후 파일 해시 보존도 통과했다.

첫 전체 회귀는 live.test.js의 검사가 끝난 뒤 StatWatcher 하나가 부모 임시 디렉터리를 감시해 종료되지 않았다.
해당 프로세스만 진단·종료했고, 서버/감지기를 닫은 다음 임시 루트를 삭제하도록 테스트 정리 순서를 바꿨다.
이후 Node 93개 전체가 약 7.5초에 정상 종료했다. 제품 감지기 코드는 이번에 변경하지 않았다.

문서 6개의 로컬 링크/앵커 32개·요구/결정/인수 ID 46개·Phase 0~7 검증 관문과
manifest/lockfile의 두 bin 일치가 통과했다. npm pack --dry-run은 런타임 파일 35개를 확인했다.
추가 임시 설치에서 pnpm 10.13.1의 pnpm docmap --help / --version도 통과했다.
로컬 설치용 tarball: /private/tmp/superlucky84-ddd-docmap-0.0.0-dev.0.tgz.

## docatlas 이름 변경과 MIT 배포 준비 — 완료

2026-10-28 사용자 선택: npm name과 명령은 docatlas, GitHub 저장소도 superlucky84/docatlas,
라이선스는 MIT다. 대응: RQ-09·10 / DC-12 / M-08·11.

- [x] 기준 4종에 새 이름·라이선스·파일 목록과 이전 명령/설정의 호환 정책을 기록한다.
- [x] package.json·lockfile·공개 import·실행 파일·도움말·화면·README를 함께 갱신한다.
- [x] MIT LICENSE와 최초 공개 후보 버전 0.1.0, npm 공개 배포 설정을 준비한다.
- [x] Test Hardening: 세 명령 이름·버전·오류·패키지 파일 목록·공개 import를 검증한다.
- [x] Integration Test: docatlas tarball을 별도 설치해 cwd·읽기·검색·갱신·원본 보존·신호 종료를 검증한다.
- [x] npm run check, npm test, Chrome 전체 회귀, 설치 통합, npm pack --dry-run, npm publish --dry-run과 문서 정합성을 확인한다.
- [x] GitHub 저장소를 docatlas로 바꾸고 동일 저장소 ID·새 URL과 로컬 origin을 확인한다.
- [x] npm 등록 가능 여부와 로그인 상태, 실제 배포 여부·남은 작업을 기록한다.
- [x] README의 미설치/설치 실행 방법·cwd 루트·tarball·옵션을 docatlas 기준으로 정리한다.
- [x] 이번 변경을 커밋하고 새 GitHub 저장소에 반영한 뒤 원격 README를 확인한다.

기준 테스트: Node 93개·Chrome 34개·설치 통합 4개, 현재 origin의 공개 저장소와 기존 명령.
종료 기준: 이름·라이선스·파일 목록이 일치하는 tarball과 새 GitHub 저장소를 확인한다.
npm 로그인·수동 인수·최종 지원 환경·실제 npm 배포는 각각 실행 결과를 구분해 기록한다.
사용자는 이번에는 배포 준비까지만 진행하도록 선택했다. 실제 npm publish는 실행하지 않는다.

검증: macOS 15.6.1 / Node 22.12.0 / Chrome 156.0.8078.48.
문법 48개·Node 93개·Chrome 34개·최종 bin 경로의 설치 통합 4개가 통과했다.
기준 4종·README·AGENTS의 링크/앵커 33개(새 GitHub 문서 링크도 로컬 원본에 대응해 확인),
요구/결정/인수 ID 48개와 Phase 0~7 검증 관문이 통과했다. manifest/lockfile의 name/version/license/세 bin도 일치한다.

배포 후보는 /private/tmp/docatlas-0.1.0.tgz다. npm pack·publish dry-run에서 28개 파일을 확인했다.
초기 publish dry-run의 bin 경로 정규화 경고는 ./ 접두사를 제거한 뒤 해소했다.
최종 세 명령과 공개 import·브라우저 브랜드·읽기/검색/갱신·원본 보존·신호 종료를 설치 통합으로 다시 확인했다.

GitHub 저장소는 https://github.com/superlucky84/docatlas로 변경했다.
저장소 ID 1435263800(GraphQL R_kgDOVYxjOA)이 유지됐고 origin의 fetch/push URL도 새 주소다.
npm 레지스트리의 docatlas 조회는 404였으며 이름 확보는 아직 하지 않았다.
npm whoami는 샌드박스 DNS 실패 뒤 허용된 네트워크에서 재확인했지만 401 Unauthorized였다.
사용자가 배포 준비까지만 선택했으므로 실제 배포는 수행하지 않는다. 이후 배포 시 재로그인이 필요하다.

README 실행 예제를 추가 검증했다. 프로젝트 manifest/node_modules가 없는 임시 대상에서
tarball을 지정한 npm exec의 일회성 실행이 0.1.0을 출력했고 대상에는 문서 외 파일이 생기지 않았다.
같은 tarball을 로컬 개발 의존성으로 설치한 뒤 npm exec와 pnpm 10.13.1의 docatlas 실행도
0.1.0을 출력했다. 원본 문서 내용이 유지됨을 확인했다. registry 이름으로 실행하는 예제는 배포 후 사용하도록 표시했다.

구현 커밋 e9977a4(feat: rename package and CLI to docatlas)를 새 origin의 main에 push했다.
GitHub에서 README와 package.json을 다시 읽어 새 이름·MIT·실행 안내를 확인했다.
README blob은 95f8d2ddfaa425509fca908ac194109203c72301이며 설치 여부별 사용법과 cwd 기본 루트를 설명한다.

## 수집 범위와 설정 안내 — 0.2.0 구현 완료

대응: RQ-11·12 / DC-13 / M-01·07·09·11·13. 기준 커밋은 ceb5b3e다.
배포된 0.1.0은 보존하며 새 공개 후보는 0.2.0으로 준비한다. 실제 npm 배포는 이번 범위에 포함하지 않는다.

### 범위·설정 구현

- [x] 기준 4종에 두 CLI 옵션·새 파일 우선/fallback·원본 경계·설정 우선순위를 먼저 기록한다.
- [x] collectProject/scan/store/CLI에 독립적인 수집 옵션을 전달한다.
- [x] docatlas.config.json을 우선하고 이전 파일은 fallback하며 두 파일을 감지한다.
- [x] 실제 사용한 설정 파일을 오류/경고에 표시한다. CLI 옵션은 설정 갱신 후에도 유지한다.
- [x] --help와 README에 옵션·설정 필드 전체·예제·기본값 대체를 설명한다.

기준 테스트: 문법 48개·Node 93개·Chrome 34개·설치 통합 4개와 기존 수집·접근 정책.
종료 기준: 기본 동작은 유지하며 추가 폴더/전체 Markdown과 새/이전 설정 파일이 같은 세대로 동작한다.

### Test Hardening

- [x] CLI/설정 조합·반복 경로·한글/공백·리터럴 glob 문자·잘못된 경로·node_modules/.git·ignore·symlink를 검증한다.
- [x] 두 설정 파일의 우선순위·오류 위치·생성/삭제/fallback과 마지막 정상 인덱스·복구를 검증한다.
- [x] 추가 폴더의 생성/삭제와 옵션 유지, 문서/이미지 요청 시 새 제외 규칙 재검증을 확인한다.

기준 테스트: 기존 전체 회귀와 수집/설정/CLI/live/reading-server 경계 테스트.
종료 기준: 새로운 포함 옵션도 기존 파일 정책과 종료·세대 일관성을 지키며 재현한 실패가 해소된다.

### Integration Test와 문서 반영

- [x] 0.2.0 tarball 설치 CLI에서 --docs-dir와 --all-md, 새 설정과 이전 fallback을 검증한다.
- [x] 문법·Node·Chrome·설치 통합·pack/publish dry-run·문서/설정 예제 정합성을 확인한다.
- [x] 기존 Confluence 팀 가이드에 전체 설정과 이름 변경·옵션 사용법을 배포 버전과 구분해 반영한다.

기준 테스트: 실제 설치 패키지의 지도/검색/읽기/저장 갱신/원본 보존과 기존 다중 실행/신호 종료.
종료 기준: 실행 가능한 0.2.0 후보와 정확한 README/--help/팀 가이드를 제공하고 실제 npm 배포 여부를 명시한다.

### 0.2.0 완료 검증 — 2026-10-28

환경: macOS / Node 22.12.0 / arm64 / Chrome 156.0.8078.48. 이번 변경에서 Node 24·다른 OS를 재검증한 것으로 표시하지 않는다.

| 검증 | 결과 |
| --- | --- |
| npm run check | JavaScript 50개 통과 |
| npm test | 109개 통과. discovery/config/CLI/live/reading-server와 기존 경계·검색·종료 회귀 포함 |
| DOCMAP_BROWSER_CHANNEL=chrome npm run test:browser | 34개 통과 |
| DOCMAP_BROWSER_CHANNEL=chrome DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm run test:integration | 4개 통과. 실제 production-only/offline tarball의 JS 10문서·비 JS 11문서, 새 옵션·새/이전 설정·API·읽기·갱신·원본 해시·신호 종료 |
| npm pack --dry-run / npm publish --dry-run | docatlas@0.2.0, 실행 파일·options 모듈·README·LICENSE 포함 29개 파일. 실제 npm 게시 없음 |
| Markdown/JSON 예제 | README·기준 4종·팀 가이드의 JSON 7개와 로컬 링크 27개·이미지 5개 확인. 설정 예제는 실제 loader로 검증 |
| Confluence | 기존 페이지 1735491669를 버전 3으로 갱신. 이미지 5장·대상 페이지 1개 동기화, 기존 다른 변경 파일 7개 보존 |

팀 가이드: 사내 Confluence 페이지 ID 1735491669.
로컬 원본은 ~/project/confluence/page/share/1735491669.md다. 0.1.0 배포본과 0.2.0 후보의 차이를 명시했다.
Confluence의 다른 문서가 함께 게시되지 않도록 원본 publish/sync 명령을 대상 페이지만 담은 임시 작업 폴더에서 실행했다.

다음: 실제 프로젝트의 사용성 인수·npm 0.2.0 별도 배포·남은 지원 환경 검증.
기술적 차단 없음. 최신 확인 커밋은 ceb5b3e이며 이번 변경은 미커밋이다. 기존 인계는 이전 단계의 기록으로 보존한다.

## 검색 결과에서 트리 위치 찾기 — 구현 완료

대응: RQ-13 / DC-14 / M-03·05·07·12. 0.2.0 준비본에 추가하며 실제 npm 배포는 하지 않는다.

### 구현

- [x] 기준 4종에 경로 버튼·검색 해제·트리 펼침/스크롤/초점·현재 본문 보존 계약을 기록한다.
- [x] 검색 결과의 경로를 별도 동작으로 표시하고 현재 트리의 문서를 찾는다.
- [x] 진행 중인 검색/사용자 열기 요청과 초점·스크롤·모바일 지도 전환을 처리한다.
- [x] README의 검색 사용법을 갱신한다.

기준 검증: 현재 Node 109개·Chrome 34개·설치 통합 4개와 검색/지도/읽기 이력 계약.
종료 기준: 제목의 문서 열기와 경로의 트리 탐색이 독립적으로 동작한다.

### Test Hardening

- [x] 접힌 다단계·루트/한글/동명/긴 경로·키보드·모바일·본문/원문/위치 보존을 검증한다.
- [x] 검색 및 사용자 열기의 늦은 응답·자동 갱신·초점 보존·삭제·이전 경로의 현재 위치를 검증한다.

기준 검증: browser search/live/hardening 시나리오와 독립 지도/본문 스크롤.
종료 기준: 경로 찾기 뒤 검색이 되살아나거나 오래된 문서 이동이 화면을 덮어쓰지 않는다.

### Integration Test

- [x] 문법·전체 Chrome·실제 설치 tarball 검색→경로→트리→본문 흐름과 pack dry-run을 확인한다.
- [x] README·기준 4종과 최신 검증/인계를 정리한다.

기준 검증: 설치된 0.2.0 패키지·원본 보존·기존 읽기/갱신/종료.
종료 기준: npm 재배포 없이 검토 가능한 준비본과 검증 근거를 제공한다.

### 검색 경로 탐색 완료 검증 — 2026-10-28

- npm run check: JavaScript 51개 통과.
- DOCMAP_BROWSER_CHANNEL=chrome npm run test:browser: 전체 40개 통과. 새 search-path.spec.js의 6개와 기존 검색/이력/읽기 회귀 포함.
- DOCMAP_BROWSER_CHANNEL=chrome DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm run test:integration: 4개 통과.
  실제 설치된 추가 디렉터리 문서를 검색 → 경로 클릭 → 트리 초점/강조 → 본문 열기로 확인했고 기존 원본 해시·갱신·종료도 통과했다.
- npm pack --dry-run: 29개 파일. 수집기/서버 계약은 이번 UI 작업에서 바꾸지 않았다. 직전 Node 전체 109개 통과 기록은 위 수집 범위 단계에 있다.
- Chrome 156.0.8078.48 / Node 22.12.0 / macOS arm64. 모바일 390×844와 데스크톱 1440×1000을 검증했다.
- 가상 예제의 검색/트리 이동 캡처 2개를 /private/tmp/docatlas-search-path-preview/에 남기고 경로 표시·대상 테두리·본문 유지를 시각 확인했다.
  기존 Confluence 가이드는 이번 검색 기능으로 추가 게시하지 않았다.

## Python·Java 기본 제외와 Windows 점검 — 구현·로컬 검증 완료

대응: RQ-14·15 / DC-15 / M-01·07·08·09·11·12·13. 기준 커밋 1ec2bd6, 새 후보 0.2.1.

### 구현

- [x] 기본 제외와 Windows 경로/신호·검증 한계를 기준 4종에 먼저 기록한다.
- [x] 언어별 생성 폴더의 기본 제외와 README 전체 목록·설정 대체·OS 사용법을 반영한다.
- [x] Windows와 macOS에서 실행할 플랫폼 검증 명령과 CI를 준비하고 파일명/실행기 가정을 점검한다.
- [x] 배포된 0.2.0과 다음 후보를 구분하고 문서의 기본 실행 예제는 고정 버전 없이 유지한다.

기준 검증: 문법 51개·Node 109개·Chrome 40개·설치 통합 4개.
종료 기준: 기본 제외 확장이 기존 설정/원본 정책을 유지하고 Windows 실행·검증 범위를 정확하게 안내한다.

### Test Hardening

- [x] Python·Java 가상 프로젝트에서 루트/중첩 생성 폴더를 탐색하지 않고 일반/유사 이름 소스 문서를 보존한다.
- [x] include/CLI 조합·exclude 대체·ignore·기존 읽기/감지 경계·설정 변경 복구를 확인한다.
- [x] 네이티브 경로·한글/공백·CRLF·링크/이미지·라이브 갱신과 주입 신호의 정상 정리를 검증한다.
- [x] 플랫폼 공통 검증 대상에서 Windows 불가 파일명을 보정하고 .cmd/심볼릭 링크/강제 종료를 혼동하지 않는다.
  기존 전체 Node/설치 통합의 POSIX 전제는 남아 있으므로 Windows 전체 통과를 주장하지 않는다.

기준 검증: 기능 테스트·서버/CLI 수명주기·플랫폼 공통 테스트와 기존 전체 회귀.
종료 기준: 언어별 제외가 과도한 일반 경로 제외나 접근 정책 우회를 일으키지 않는다.

### Integration Test

- [x] 실제 tarball 플랫폼 검증으로 npm 실행 shim·별도 위치/manifest 없는 대상·API/CLI·원본 보존을 확인한다.
- [x] 문법·Node·플랫폼·Chrome·설치 통합·pack dry-run·문서/설정 예제를 확인한다.
- [x] Windows CI를 준비하되 로컬 macOS 결과와 미실행 원격/수동 항목을 분리해 인계한다.

기준 검증: production-only tarball과 기존 탐색·검색·갱신·종료 및 Node 22/24 CI 행렬.
종료 기준: 검토 가능한 후보와 실행 가능한 Windows 검증 경로를 제공한다. 실제 Windows 검증은 실행 전 미실행으로 남긴다.

### 0.2.1 로컬 검증 — 2026-10-28

환경: macOS / Node 22.12.0 / arm64 / Chrome 156.0.8078.48. 다른 OS·Node 24에서 이번 후보를 실행한 결과가 아니다.

| 명령/범위 | 결과 |
| --- | --- |
| npm run check | JavaScript 54개 통과 |
| DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm test | 115개 통과. 언어별 3개·플랫폼 3개 포함 |
| DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm run test:platform | 6개 통과. 코드/빌드 미실행·생성 폴더 가지치기·범위/정책·라이브 재설정·실제 설치된 세 npm 명령·대상 해시·신호 핸들러 정리 |
| DOCMAP_BROWSER_CHANNEL=chrome npm run test:browser | 40개 통과. 경로 탐색 fixture의 큰따옴표를 Windows 유효 문자로 보정 |
| DOCMAP_BROWSER_CHANNEL=chrome DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm run test:integration | 4개 통과. 0.2.1 production-only/offline 설치·읽기/검색/갱신/종료·원본 보존 |
| npm pack --dry-run | 29개 파일. 기준 문서·테스트·CI는 배포에서 제외 |
| README/기준 4종 | JSON 4개·로컬 링크/앵커 27개 통과. README의 18개 기본 exclude를 실제 loader 결과와 대조 |
| CI | platform.yml의 YAML 구문과 Windows/macOS Node 22/24 행렬 확인. 원격 CI 미실행, actionlint 미설치 |

Windows workflow는 test:platform과 test:browser를 실행한다. full npm test/test:integration은 POSIX 전제가 남아 별도 이식 대상이다.
Windows 네이티브 Ctrl+C·기본 브라우저·PowerShell/CMD·UNC/네트워크 드라이브는 실제 인수 전 미검증이다.

## 에이전트 스킬 관리와 설치 — Integration Test 자동 검증 완료

대응: RQ-16·17·18 / PR-09·10 / DC-16~19 / M-16·17. 기준 커밋 d71ee97, 계획 cc9e98d, 1단계 b85e00e, 2단계 59a561e,
3단계 49143c0, 4단계 ead614f, Test Hardening 5bb8c7a. 다음 후보 버전은 사용자 요청으로 0.3.0으로 확정했다.
상태: 설치 tarball로 전 과정을 자동 검증했고 DC-18을 해소했다. PR #1의 Windows/macOS CI가 통과했다. 사람의 M-16·17 인수가 남았다.

진입 조건: DC-19 공개 범위 확인. 2026-10-28 사용자 확인으로 충족했다.

### 1단계 — 원본 이관: 완료

- [x] 2026-10-28 ctxbin에 올린 세 쌍과 같은 내용으로 agent-kit/skills·agents를 만들었다. 사람용 agent-kit/README.md를 함께 둔다.
- [x] manifest.json에 kit 1.0.0, 항목별 버전·파일 해시와 이전 배포본 해시를 기록했다.
  이전 해시는 ctxbin 백업과 Confluence 팀 페이지 v5에서 얻었다. 팀 페이지의 designer 스킬은 이전 ctxbin 파일과 같고,
  룰은 frontmatter 없이 실려 있으며 이전 ctxbin 룰의 본문과 같다.
- [x] scripts/agent-kit.js와 npm run check에 원본 검사를 추가했다. frontmatter 구문, 룰은 name·description만, name·버전·경로 일치,
  manifest 해시, 이전 항목의 버전·중복, 목록 밖 파일·링크·UTF-8을 확인한다. 개발 전용이며 npm 패키지에 포함하지 않는다.
- [x] AGENTS.md에 agent-kit 원본 관리와 배포본 갱신 순서를 추가했다.

남은 일: Confluence 팀 페이지는 아직 이전 designer 1.0.0이다. RQ-16 인수에 필요하며 갱신 시점은 사용자가 정한다.
후속(2026-10-30): 팀 페이지를 designer 1.2.0으로 갱신했다(v6). 룰은 팀원이 정한 이름·tools 머리말을 유지해 본문만 원본과 같다.
자세한 내용은 아래 "0.4.1 배포 준비" 단계의 Confluence 갱신에 있다.

기준 검증: npm run check, npm test, npm pack --dry-run(패키지 파일 목록 변화 없음).
종료 기준: 원본과 manifest가 검사를 통과하고 npm 패키지 내용은 바뀌지 않는다. 충족했다.

#### 1단계 검증 — 2026-10-28

환경: macOS / Node 22.12.0.

| 명령/범위 | 결과 |
| --- | --- |
| npm run check | JavaScript 56개 문법, agent kit 1.0.0의 세 쌍 검사 통과 |
| DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm test | 124개 통과. agent-kit.test.js 9개 포함 |
| npm pack --dry-run | 29개 파일. 기존과 같고 agent-kit/·scripts/·test/는 포함하지 않는다 |
| ctxbin 대조 | agent-kit의 세 스킬이 ctxbin의 현재 값과 같다 |

### 2단계 — 설치 판정 모듈: 완료

- [x] src/agent-kit/에 원본 읽기(manifest 해시 확인)·대상 경로 계산·Codex TOML 변환·판정을 구현했다.
  node 기본 모듈만 쓰며 수집기·서버·화면과 서로 참조하지 않는다. 1단계 해시·frontmatter 규칙을 옮겨 검사 스크립트도 같은 모듈을 쓴다.
- [x] 임시 HOME과 가상 프로젝트로 create/unchanged/replace(recorded·previous-file·previous-body)/skip-modified/
  skip-downgrade/skip-managed/blocked, --force 백업 표시, 같은 이름 경고, 읽을 수 없는 기록, 쓰기 없음을 테스트했다.
- [x] 설계와 달라진 점: 전역 설치에서는 ~/.claude 같은 클라이언트 폴더 자체가 디렉터리 링크여도 허용한다.
  dotfiles 저장소로 설정 폴더를 관리하는 사용자를 막지 않기 위해서다. 그 아래 경로와 프로젝트 설치의 링크는 계속 거부한다.

기준 검증: npm run check, npm test.
종료 기준: 파일을 쓰지 않는 판정 결과가 테스트로 고정된다. 충족했다.

#### 2단계 검증 — 2026-10-28

환경: macOS / Node 22.12.0.

| 명령/범위 | 결과 |
| --- | --- |
| npm run check | JavaScript 63개 문법, agent kit 세 쌍 검사 통과 |
| DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm test | 134개 통과. agent-kit-plan.test.js 10개 포함 |
| npm pack --dry-run | 34개 파일. src/agent-kit/ 5개가 늘었고 agent-kit/는 3단계 전까지 포함하지 않는다 |
| 실제 HOME 판정(쓰기 없음) | 세 스킬은 Claude·Codex 모두 unchanged. 룰은 ctxbin이 관리해 skip-managed. ~/.docatlas를 만들지 않았다 |

### 3단계 — 설치 명령과 에이전트용 도움말: 완료

- [x] docatlas agents install·help(install --help 포함)와 docatlas --help의 안내 두 줄을 추가했다. agents 외의 위치 인자는 기존처럼 오류다.
- [x] 쓰기 전 재확인(판정 이후 변경·링크)·--force 백업·임시 파일 후 이름 변경·설치 기록·실패 시 복구를 src/agent-kit/install.js에 구현했다.
  대화형 질문 없이 탭 구분 결과 줄과 종료 코드 0/1/2/3으로 알린다.
- [x] package.json files에 agent-kit/를 추가하고 README에 Agent skills 사용법을 추가했다. 미배포 기능으로 표시했고 팀 안내 시점은 사용자가 정한다.

기준 검증: npm run check, npm test, npm pack --dry-run.
종료 기준: 임시 HOME에서 전역/프로젝트 설치·재실행·보호·--dry-run 무쓰기와 도움말-옵션 대조가 통과한다. 충족했다.

#### 3단계 검증 — 2026-10-28

환경: macOS / Node 22.12.0.

| 명령/범위 | 결과 |
| --- | --- |
| npm run check | JavaScript 66개 문법, agent kit 세 쌍 검사 통과 |
| DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm test | 143개 통과. agent-kit-install.test.js 9개 포함 |
| npm pack --dry-run | 44개 파일, 59.6kB. agent-kit/ 8개와 src/agent-kit/ 7개 포함 |
| 설치 명령 테스트 | dry-run 무쓰기, 설치·기록·재실행 무변경, 이전 배포본 교체, 수정본 skip(종료 3)과 --force 백업, 프로젝트 설치·같은 이름 경고, 인자 오류 8종, 쓰기 실패 복구, 판정 후 변경 중단, bin 경유 실행 |

### 4단계 — 업데이트 안내: 완료

- [x] 문서 지도 시작 시 manifest와 전역·문서 지도 루트의 설치 기록을 읽어 낡은 kit이면 미리보기 명령과 함께 한 줄로 안내한다.
  src/agent-kit/notice.js. 쓰기 없음, 읽기 실패 무시, 서버 준비와 종료에 영향 없음.
- [x] 4단계 결정: 설치 기록이 없는 손 복사본에는 안내하지 않는다. Confluence 우선 배포 방침과 맞추기 위해서다.
- [x] 테스트 도우미 startCli에 env 옵션을 추가해 임시 HOME으로 실제 CLI를 검증한다.

기준 검증: npm test의 CLI·수명주기 테스트.
종료 기준: 안내가 표시되고 기존 시작·종료·신호 정리 테스트가 그대로 통과한다. 충족했다.

#### 4단계 검증 — 2026-10-28

환경: macOS / Node 22.12.0.

| 명령/범위 | 결과 |
| --- | --- |
| npm run check | JavaScript 68개 문법, agent kit 세 쌍 검사 통과 |
| DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm test | 149개 통과. agent-kit-notice.test.js 6개 포함, 기존 CLI·수명주기·종료 테스트 그대로 통과 |
| npm pack --dry-run | 45개 파일. src/agent-kit/notice.js 추가 |

### Test Hardening: 완료

- [x] 실패 복구: --force로 고친 파일을 교체한 뒤 쓰기 권한 없는 폴더에서 실패해도, 고친 파일을 원래 내용·권한으로 되돌리고 백업을 남긴다.
- [x] 동시 실행: 찾은 문제 — 실패한 실행의 복구가 다른 실행이 쓴 파일을 지울 수 있었다. <base>/.docatlas/install.lock 잠금을 추가했다.
  잠금이 있으면 아무것도 바꾸지 않고 종료 1. 세 실행을 동시에 돌려도 결과는 한 벌이고 임시 파일·잠금이 남지 않는다.
- [x] 권한: 찾은 문제 — 교체한 파일의 권한 비트가 기본값으로 바뀌었다. 교체와 복구 때 기존 권한을 유지한다.
- [x] 한글/공백이 든 HOME·프로젝트와 CRLF 원본: LF로 설치되고 재실행은 unchanged, 프로젝트 설치는 같은 이름 경고 4개를 낸다.
- [x] 판정 뒤 생긴 심볼릭 링크: 쓰기 전에 멈추고 아무것도 바꾸지 않는다.
- [x] 이전 docatlas는 높은 버전 설치본을 낮추지 않고(skip-downgrade, 종료 3), ctxbin 관리 사본은 건드리지도 기록하지도 않는다.
- [x] test:platform: production tarball의 npm 실행기로 한글·공백 HOME(HOME·USERPROFILE 지정)에 미리보기·설치·재실행을 검증한다. macOS 통과.
- [x] 같은 플랫폼 검증의 Windows 실행: PR #1의 CI에서 Windows Node 22/24 모두 6개 통과(아래 Integration Test 기록).

기준 검증: npm test, npm run test:platform.
종료 기준: 어떤 실패에서도 사용자가 고친 파일이 사라지지 않고 백업으로 복원할 수 있다. macOS에서 충족했다.

#### Test Hardening 검증 — 2026-10-28

환경: macOS / Node 22.12.0.

| 명령/범위 | 결과 |
| --- | --- |
| npm run check | JavaScript 69개 문법, agent kit 세 쌍 검사 통과 |
| DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm test | 155개 통과. agent-kit-hardening.test.js 6개 포함 |
| DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm run test:platform | 6개 통과. tarball npm 실행기로 한글·공백 HOME에 agents 미리보기·설치·재실행 포함 |
| npm pack --dry-run | 45개 파일 |

### Integration Test: 자동 검증 완료

- [x] F-09(test/integration/agent-kit.test.js): production tarball을 팀 프로젝트의 개발 의존성으로 설치하고 임시 한글 HOME으로
  도움말→미리보기(무쓰기)→설치→재실행, 프로젝트 --all 설치와 경고, 문서·AGENTS.md·CLAUDE.md 무변경, 문서 지도에 설치 파일이
  나타나지 않음, 낡은 기록의 안내→갱신 후 사라짐, 수정본 종료 3과 --force 백업을 확인했다.
- [x] Windows/macOS CI 대상인 test:platform에 tarball npm 실행기 설치 검증을 추가했다(Test Hardening). 실제 CI 실행은 아래 남은 일이다.
- [x] DC-18: Codex CLI 0.165.0의 codex debug prompt-input(모델 호출 없음)으로 격리한 HOME·CODEX_HOME에서 관찰했다.
  프로젝트 스킬은 신뢰와 무관하게, 프로젝트 룰은 신뢰한 프로젝트에서만 읽고, 같은 이름 룰은 프로젝트가 우선이다.
  같은 이름 경고 문구를 확정하고 프로젝트 설치에 codex-trust 경고를 추가했다.
- [x] platform CI의 Windows·macOS 실행: PR #1, run 40665207058, fa90bfd. 네 작업 모두 통과.
- [x] M-17 Claude Code: 사용자가 Claude Code 2.1.308 새 세션에서 프로젝트 룰이 전역보다 우선하고 같은 이름 스킬은 전역이 쓰임을 확인했다.
- [ ] M-17 Codex 사람의 실제 세션 확인(자동 관찰은 DC-18). 나머지 M-16 수동 항목.

기준 검증: npm run test:integration, npm run test:platform, npm pack --dry-run.
종료 기준: 설치 tarball로 설치와 갱신이 재현되고 실제 클라이언트 로드 결과를 기록한다. 자동 부분과 Codex 관찰은 충족했다.

#### Integration Test 검증 — 2026-10-28

환경: macOS / Node 22.12.0 / Chrome. Codex CLI 0.165.0.

| 명령/범위 | 결과 |
| --- | --- |
| npm run check | JavaScript 70개 문법, agent kit 세 쌍 검사 통과 |
| DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm test | 155개 통과 |
| DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm run test:platform | 6개 통과 |
| DOCMAP_BROWSER_CHANNEL=chrome DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm run test:integration | 5개 통과. 새 F-09 포함 |
| npm pack --dry-run | 45개 파일 |
| codex debug prompt-input 관찰 | 위 DC-18 결과. 실제 HOME과 Codex 설정은 쓰지 않았다 |
| [platform CI 40665207058](https://github.com/superlucky84/docatlas/actions/runs/40665207058) | macOS·Windows × Node 22/24 네 작업 통과. 각 작업 문법·agent kit 검사, 플랫폼 6개(tarball npm 실행기로 한글·공백 HOME에 agents 설치 포함), pack 45파일. Windows는 USERPROFILE과 .cmd 실행기 경로 |

## 0.3.0 배포 준비 — 완료

대응: RQ-10·14·16~18 / DC-12·15~19 / M-11·16·17.
진입: 작업 트리가 깨끗하고 PR #1 병합 커밋 47ff79a로 main을 fast-forward했다.
기준 검증: 변경 전 npm run check 통과(JavaScript 70개·agent kit 세 쌍), npm registry latest 0.2.0·0.3.0 미게시 확인.

- [x] manifest·lockfile을 npm version 0.3.0 --no-git-tag-version --ignore-scripts로 갱신한다.
- [x] README의 후보 버전·tarball 예제와 기준 4종의 최신 결정을 맞춘다.
- [x] npm run check, npm test, 설치 통합, pack/publish dry-run과 CLI 버전을 확인한다.
- [x] 실제 npm 게시 전 커밋·푸시, 인증, dry-run, publish, registry/실행 확인 순서를 안내한다.

종료 기준: 0.3.0 후보에 agent-kit/와 런타임이 포함되고 검증 결과·미게시 상태가 명확하다.
기존 Test Hardening·Integration Test 단계와 미완료 수동 인수는 유지한다.
실제 npm publish·커밋·푸시·태그 생성은 이번 요청에서 실행하지 않는다.

검증 환경: macOS / Node 22.12.0 / npm 11.20.0 / Chrome 156.0.8078.48.

| 명령/범위 | 결과 |
| --- | --- |
| npm run check | JavaScript 70개·agent kit 1.0.0 세 쌍 통과 |
| DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm test | 155개 통과. 플랫폼 production tarball 검사와 세 npm 실행기의 0.3.0 출력 포함 |
| DOCMAP_BROWSER_CHANNEL=chrome DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache npm run test:integration | 5개 통과. agent 설치·갱신·수정본 보호와 문서 탐색·읽기·감지·종료·원본 보존 |
| npm pack --dry-run / npm publish --dry-run | docatlas@0.3.0, 45개 파일, 60,990 bytes. 스킬·룰 세 쌍과 manifest·런타임 포함, 개발 문서·테스트 제외. 실제 게시 없음 |
| CLI / manifest / lockfile | 0.3.0 일치. 의존성·agent kit 버전·원본 해시는 변경하지 않음 |

### 사용자가 실행할 0.3.0 배포 절차

main의 이번 변경을 커밋·푸시하고 플랫폼 CI 성공을 확인한 뒤 npm에 게시한다.
package.json은 이미 0.3.0이므로 npm version을 다시 실행하지 않는다.

```sh
git add package.json package-lock.json README.md docs/REQUIREMENTS.md docs/DESIGN.md docs/IMPLEMENT.md docs/MANUAL_TEST_CHECKLIST.md
git commit -m "chore: prepare 0.3.0 release"
git push origin main
```

CI: https://github.com/superlucky84/docatlas/actions/workflows/platform.yml.
인증 확인이 실패하면 npm login --registry=https://registry.npmjs.org/로 로그인한 뒤 계속한다.

```sh
npm whoami --registry=https://registry.npmjs.org/
npm publish --dry-run --access public --registry=https://registry.npmjs.org/
npm publish --access public --registry=https://registry.npmjs.org/
npm view docatlas version --registry=https://registry.npmjs.org/
npm view docatlas@0.3.0 version --registry=https://registry.npmjs.org/
npx --yes docatlas@0.3.0 --version
npx --yes docatlas@0.3.0 agents help
```

로그인·게시 시 표시되는 브라우저/2FA 절차를 따른다. registry와 실제 CLI에서 0.3.0을 확인한다.
선택적으로 게시 성공 후 git tag v0.3.0, git push origin v0.3.0으로 버전 태그를 남긴다.
공식 절차: https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/.

게시 확인(2026-10-28): npm view docatlas@0.3.0 version이 0.3.0, dist-tag latest가 0.3.0이다.
빈 임시 폴더에서 npx --yes docatlas@0.3.0 --version이 0.3.0을 출력했다.

## 저장소 소개와 DDD 본거지 — 완료

대응: RQ-19 / DC-20·21 / M-18.
진입: 사용자 결정(2026-10-28)을 기준 4종에 기록했다. 작업 브랜치 claude/tender-gates-sa5kn8, 기준 커밋 00064c2.
기준 검증(변경 전): npm run check 문법 70개·agent kit 1.0.0 세 쌍 통과.
npm test 155개 중 152개 통과·3개 건너뜀·실패 0. 건너뛴 3개는 root 권한 환경에서 실행하지 않는 POSIX 권한 테스트다.
npm pack --dry-run 45개 파일. 환경: Linux / Node 22.22.0 / npm 10.9.4.

### 구현

- [x] METHOD.md: 정의·원칙·4종 문서·흐름·작성 규칙·역할·문서 배치·spec-driven 도구와의 차이·블로그 링크.
- [x] README: RQ-19 계약의 순서로 재구성하고 기존 사용법을 Reference로 옮긴다. #configuration 앵커를 유지한다.
- [x] CONTRIBUTING.md: 개발·검사·브라우저/설치 통합·플랫폼·벤치마크·소스 tarball 안내를 README에서 옮긴다.
- [x] CHANGELOG.md: 게시한 0.1.0~0.3.0의 변경 요약. README의 버전별 신규 표시를 옮긴다. 날짜는 npm 게시 시각이다.
- [x] agent-kit/README.md: 설치 명령 안내를 현재 동작에 맞추고 사본 관계 문구를 뺀다. 스킬 변경 시 METHOD 확인 단계를 넣는다.
- [x] package.json의 description·keywords.
- [x] 합성 예제 프로젝트로 문서 지도 캡처를 만들어 .github/assets/document-map.png에 둔다.
  재현용 개발 스크립트 scripts/screenshot.js를 추가했다(npm 패키지 제외). 같은 예제로 두 번 만든 PNG가 바이트 단위로 같다.

### Test Hardening

- [x] 이전 README의 모든 제목·표·명령이 README나 CONTRIBUTING에 남았는지 대조한다.
  이전 README의 비어 있지 않은 줄을 새 README·CONTRIBUTING·CHANGELOG와 줄 단위로 비교했다. 그대로 없는 48줄은 제목 단계 변경,
  버전·checkout 표현 수정, 중복 redirects 안내의 링크 대체, 오래된 배포 문구 삭제였다. 빠진 문서 지도 소개 한 문장은 복원했다.
- [x] 오래된 문구를 검색한다: planned but not available, in this checkout, before it is published, 공개 안내의 Confluence·wiki.
  README·METHOD·CONTRIBUTING·CHANGELOG·agent-kit/README에서 0건. ctxbin은 설치 동작 설명 한 곳에만 남았다.
- [x] METHOD의 규칙 문장을 세 스킬·룰의 해당 문장과 대조한다. 새 규칙을 만들지 않았고 역할·순서·승인 조건이 스킬과 같다.

### Integration Test

- [x] npm run check, npm test가 기준과 같다. 문법 71개(scripts/screenshot.js 추가)·agent kit 세 쌍,
  Node 155개 중 152개 통과·3개 건너뜀·실패 0.
- [x] npm pack --dry-run: README·agent-kit/README 포함, METHOD·CONTRIBUTING·CHANGELOG·docs·.github·scripts 제외, 45개 파일·61,276 bytes.
- [x] 새 문서의 상대 링크·앵커와 GitHub 절대 링크의 대상 파일·제목을 확인한다.
  README·METHOD·CONTRIBUTING·CHANGELOG·agent-kit/README와 기준 4종의 링크 90개를 github-slugger 앵커로 확인했다. 문제 0.
  docatlas 서버에 --docs-dir .로 이 저장소를 열어 다섯 문서를 읽었다. 참조 오류 없음. README 캡처는 외부 이미지라 정책대로 표시하지 않는다.
- [x] 이전 인계를 docs/handoff/로 옮긴 뒤 기준 4종의 링크·앵커를 확인한다.
  33개 절·333줄을 옮겼고 제거한 모든 줄이 인계 이력에 있다. 옮긴 앵커 38개를 새 위치로 바꿨다.

브라우저 UI·설치 통합(test:browser·test:integration)은 제품 코드와 화면을 바꾸지 않아 다시 실행하지 않았다.
이 환경의 Playwright 1.64.1용 브라우저가 없어 캡처는 미리 설치된 Chromium(--executable-path)으로 만들었다.

종료 기준: README 첫 화면에 DDD 정의와 세 구성·시작 명령이 있고, 기존 사용법 정보가 빠짐없이 새 위치에 있으며,
검사·테스트·pack 결과가 기준과 같다. 제품 코드 변경은 없다. M-18의 사람 확인(GitHub·npm 화면)은 별도다.

## METHOD 한국어판과 예제 프로젝트 — 완료

대응: RQ-19 / DC-21 / M-18.
진입: 사용자 후속 요청(2026-10-28, 남은 TBD 진행)을 기준 4종에 기록했다. 기준 커밋 b9ee4a4.
기준 검증(변경 전): npm run check 문법 71개·agent kit 세 쌍 통과. npm test 155개 중 152개 통과·3개 건너뜀·실패 0.
npm pack --dry-run 45개 파일. 이 저장소의 문서 지도는 docs/의 5개 문서다.

### 구현

- [x] METHOD.ko.md: METHOD.md와 같은 제목·표·목록 구조의 한국어 번역. 두 문서 상단에서 서로 연결한다.
  METHOD.md에는 예제 안내(## Examples)를 더했다. 흐름 그림은 정렬을 위해 영어를 유지하고 마지막 줄만 번역했다.
- [x] examples/sample-shop/: checkout 4종 전체와 부분 문서·중첩 기능·공유 계약·코드 옆 docs/, 예제 README.
  문서 21개(기능 8개)와 예제 README. checkout에 상태 표시·DC-3 TBD·phase 5개·인계·실행 기록이 있다.
- [x] 저장소 루트 docatlas.config.json으로 이 저장소의 지도를 docs/로 한정한다.
- [x] scripts/screenshot.js가 내장 문서 대신 예제를 복사해 쓰고 README 캡처를 다시 만든다.
  같은 경로(/home/user/projects/sample-shop)로 만들었고, 목차에 Policies·Test strategy가 더해졌다.
- [x] README·METHOD·CONTRIBUTING·agent-kit/README에 한국어판·예제 안내를 넣는다.

### Test Hardening

- [x] test/examples.test.js: 예제의 문서 수·checkout 4종·중첩 그룹·경고 없음, 저장소 지도의 예제 제외.
  docatlas.config.json을 잠시 치우면 저장소 지도 테스트가 실패하는 것을 확인했다.
- [x] METHOD.ko.md와 METHOD.md의 제목·표 행·목록 항목 수를 대조한다.
  제목 12개(단계 동일)·표 행 12·글머리 35·번호 9·코드 블록 2·링크 5개가 같다.

### Integration Test

- [x] npm run check, npm test(새 테스트 포함), npm pack --dry-run 45개 파일 유지(예제·한국어판 제외).
  문법 72개·agent kit 세 쌍, Node 157개 중 154개 통과·3개 건너뜀(root 권한)·실패 0, pack 45개 파일·61,443 bytes.
- [x] 링크·앵커 검사와 docatlas 서버로 예제 문서 읽기(참조 오류 없음).
  공개 안내·기준 4종·인계 이력·예제의 링크 132개 문제 0. 예제 문서 21개의 참조 17개 모두 정상.

종료 기준: 한국어판과 예제가 있고, 예제는 --root로 열리며 저장소 지도에는 섞이지 않는다. 기존 검사·테스트가 통과한다.

## 프로젝트 적용 안내와 PR — 완료(CI 확인 대기)

대응: RQ-19 / DC-22 / M-18.
진입: 사용자 결정(2026-10-28)을 기준 4종에 기록했다. 기준 커밋 fb2a87c.
기준 검증(변경 전): 문법 72개·agent kit 세 쌍, Node 157개 중 154개 통과·3개 건너뜀·실패 0, pack 45개 파일.

### 구현

- [x] METHOD.md·METHOD.ko.md에 프로젝트 적용 절: 세 단계 선택지, 가벼운 AGENTS.md·CLAUDE.md 예시, 고쳐 써도 된다는 안내.
  작성 규칙 소개도 남겨 두기로 한 문서에 적용한다는 표현으로 바꿨다. 한국어판 예시는 한국어로 썼다.
- [x] README 핵심 규칙 아래에 필요한 만큼 쓰라는 한 줄과 적용 절 링크.
- [x] examples/sample-shop/AGENTS.md와 예제 README 안내. 예제 문서 수는 21개 그대로다.
- [x] 사용자 설명 반영: METHOD 두 언어의 문서 관리 절과 README 요약에 docatlas가 그 뷰어라는 이유를 넣었다.
  후속 설명대로 정리는 에이전트에게 맡기고, 사람은 문서의 분포와 내용을 파악해 정리를 시킨다는 관점으로 고쳤다.
  두 METHOD 구조 동일(제목 14개·글머리 39·링크 7개), 링크 140개 문제 0.

### Test Hardening

- [x] 두 METHOD의 구조가 같고, 적용 절이 스킬 규칙과 모순되지 않으며 강제 표현이 없는지 확인한다.
  제목 13개·표 행 17·글머리 35·번호 9·코드 블록 3·링크 6개가 같다. 새 절에 must·required·반드시 표현이 없다.

### Integration Test

- [x] npm run check, npm test, npm run test:platform, npm pack --dry-run, 링크 검사.
  문법 72개·agent kit 세 쌍, Node 157개 중 154개 통과·3개 건너뜀·실패 0, 플랫폼 6개 통과, pack 45개 파일, 링크 136개 문제 0.
- [ ] main 대상 PR을 만들고 플랫폼 CI 결과를 확인한다.
  [PR #2](https://github.com/superlucky84/docatlas/pull/2)를 만들었다. 원격 CI 결과 확인과 병합은 남아 있다.

종료 기준: 적용 범위를 고를 수 있다는 안내와 예시가 있고, 기존 검사가 통과하며, PR이 열려 있다.

## 스펙 주도 개발과의 관계와 지원 환경 안내 — 완료

대응: RQ-15·19 / DC-10·23 / M-12·18.
진입: 사용자 결정(2026-10-28)을 기준 4종에 기록했다. 기준 커밋 f9e691e. PR #2의 CI 네 작업(macOS·Windows × Node 22·24)이 통과했다.
기준 검증: Ubuntu 24.04 / Node 22.22.0에서 Node 157개 중 154개 통과·3개 건너뜀·실패 0, 플랫폼 6개,
브라우저 40개(Playwright 1.64.1, 미리 설치된 Chrome for Testing 153.0.8010.12를 임시 설정으로 지정) 통과.
데스크톱 브라우저가 없는 환경에서 CLI가 주소를 출력하고 Ctrl+C로 정상 종료했다. 프로젝트 안 .conda·env의 패키지 문서가 수집되는 것을 재현했다.

### 구현

- [x] METHOD.md·METHOD.ko.md: 비교 절을 스펙 주도 개발과의 관계 절로 바꾼다. 두 언어 구조를 같게 유지한다.
  철학 절이라 "왜 문서인가" 바로 다음으로 옮겼다. 공통점, 중심 비교 표, 문서 관리 절 링크, 한 줄 답으로 구성했다.
- [x] README: DDD 소개 아래 스펙 주도 개발과의 관계 문단, 지원 환경 표의 Linux·WSL 행과 WSL 안내, conda 환경 안내.
  WSL 브라우저 열기는 open 패키지가 PowerShell로 Windows 기본 브라우저를 여는 코드를 확인해 적었다.

### Test Hardening

- [x] 다른 도구에 대한 서술이 공개된 흐름만 언급하고 단정하지 않는지, 지원 확정 표현이 없는지 확인한다.
  다른 도구는 "스펙을 계획·작업·코드로 이어 간다"만 언급한다. README에 supported·officially 표현이 없다.

### Integration Test

- [x] npm run check, npm test, 링크 검사, 두 METHOD 구조 대조. 이어서 PR #2에 푸시하고 CI를 확인한다.
  문법 72개·agent kit 세 쌍, Node 154개 통과·3개 건너뜀·실패 0, 링크 143개 문제 0, 두 METHOD 구조 동일(표 행 23·링크 8).

종료 기준: 스펙 주도 개발과의 공통점과 차이, Linux·WSL·conda 안내가 문서에 있고 기존 검사가 통과한다. 제품 코드 변경은 없다.

후속 보강(2026-10-28 사용자 요청):

- [x] METHOD 두 언어에 "같은 순간, 두 관점"과 "어디에서 왔나" 하위 절을 더한다. 예시는 예제 checkout 인계·DC-3와 맞춘다.
  외부 링크(adr.github.io, Readme Driven Development 원문)는 주소와 저자·연도를 확인했다.
- [x] 두 METHOD 구조 대조, 링크 검사(예제 인계 앵커 포함), npm run check·npm test.
  구조 동일(제목 16개·글머리 38·링크 11개), 링크 117개 문제 0, Node 154개 통과·3개 건너뜀·실패 0.

## .conda 기본 제외 — 완료(배포 전)

대응: RQ-14 / DC-24 / M-01·09.
진입: 사용자 선택(2026-10-28)을 기준 4종에 기록했다. PR #2 위에 쌓은 브랜치 claude/conda-default-exclusion, 기준 커밋 99a4c20.
기준 검증(변경 전): 문법 72개·agent kit 세 쌍, Node 157개 중 154개 통과·3개 건너뜀·실패 0, 플랫폼 6개 통과.
프로젝트 안 .conda·env 아래 패키지 문서가 기본 수집에 포함되는 것을 재현했다.

### 구현

- [x] src/collector/config.js의 기본 exclude에 **/.conda/**를 더한다.
- [x] 기본 제외 표·설정 예제·conda 안내, CHANGELOG의 Unreleased 항목.
  DC-25로 이 설명이 guide/configuration.md로 옮겨져, PR #2 병합 시 같은 수정을 가이드에 다시 반영했다.

### Test Hardening

- [x] 언어 예제에 루트·중첩 .conda 문서를 더하고, 탐색하지 않는 디렉터리 검사와 대소문자 무시 검사에 .conda를 넣는다.
  코드 변경 전 언어 테스트 3개가 실패하고, 변경 후 3개 모두 통과했다.
- [x] exclude: [] 대체로 .conda 문서가 다시 포함되는 기존 검사가 그대로 통과한다.

### Integration Test

- [x] npm run check, npm test, npm run test:platform(설치된 tarball에서 .conda 제외), npm pack --dry-run.
  문법 72개·agent kit 세 쌍, Node 157개 중 154개 통과·3개 건너뜀·실패 0, 플랫폼 6개 통과, pack 45개 파일.
  재현 예제에서 .conda 문서는 빠지고 env 문서는 그대로 수집된다.
- [x] PR #2를 기준으로 하는 PR을 만든다. 실제 배포는 사용자 단계다. [PR #3](https://github.com/superlucky84/docatlas/pull/3).

종료 기준: .conda 문서가 모든 깊이에서 기본 제외되고 env 등 일반 이름은 그대로이며 기존 검사가 통과한다.

## README 축약과 사용 가이드 분리 — 완료

대응: RQ-19 / DC-25 / M-18.
진입: 사용자 결정(2026-10-28)을 기준 4종에 기록했다. 기준 커밋 3929473. README는 512줄이며 Reference가 약 290줄이다.
기준 검증: 문법 72개·agent kit 세 쌍, Node 154개 통과·3개 건너뜀·실패 0, 링크 검사 문제 0.

### 구현

- [x] guide/document-map.md·guide/configuration.md·guide/platforms.md를 README 내용으로 만든다. 링크는 새 위치에 맞춘다.
  문서 지도·설정 가이드는 README 절을 그대로 옮기고 제목 단계와 링크만 바꿨다. 지원 환경 가이드는 상태 표 → Windows → WSL 순으로
  다시 묶고, Linux 결과가 생겨 "other OSes remain unverified"를 "environments not listed above"로 고쳤다.
- [x] agent-kit/README.md에 에이전트 설치 위치·갱신·출력 상세를 옮긴다.
- [x] README를 DC-25 순서로 줄인다. Configuration 제목과 가이드 링크를 남긴다. 512줄 → 132줄.
  옵션 표는 README에만 두고 설정 가이드는 링크로 바꿨다. CONTRIBUTING에 README·guide 역할을 적었다.

### Test Hardening

- [x] 이전 README의 줄을 새 README·guide·agent-kit/README와 줄 단위로 대조해 빠진 정보가 없는지 확인한다.
  378줄 중 그대로 없는 46줄을 검토했다. 요약·이동·링크 변경이었고, 빠진 METHOD 적용 절 링크와 블로그 글 링크를 되살렸다.

### Integration Test

- [x] 링크·앵커 검사(guide 포함), npm run check·npm test, npm pack --dry-run(파일 수 45개 유지).
  링크 165개 문제 0, Node 154개 통과·3개 건너뜀·실패 0, pack 45개 파일.
- [x] PR #3에 병합하고 CLI 도움말 링크를 바꾼다. src/cli.js의 설정 링크가 guide/configuration.md를 가리킨다(다음 배포).
  README의 .conda 수정은 guide/configuration.md로 옮겨 다시 반영했다.

종료 기준: README가 핵심과 링크만 담고, 이전 정보가 모두 새 위치에 있으며, 검사가 통과한다.

## implementer·reviewer 설치 안내 — 완료(배포 전)

대응: RQ-17·18 / DC-26 / M-16.
진입: 사용자 결정(2026-10-28)을 기준 4종에 기록했다. PR #2·#3이 main에 병합됐고, 작업 브랜치를 main(18ef3ad)으로 빨리 감기했다.
기준 검증: 문법 72개·agent kit 세 쌍, Node 157개 중 154개 통과·3개 건너뜀(root 권한)·실패 0.

### 구현

- [x] src/agent-kit/command.js 에이전트용 도움말: 설치 대상을 정하지 않은 요청이면 implementer·reviewer 포함 여부를 먼저 묻는 1단계.
- [x] README 빠른 시작에 --all 한 줄, agent-kit/README.md 설치 절에 기본이 designer인 이유.
  에이전트가 실제로 묻는지는 사람이 확인하지 않았으므로 "도움말이 묻도록 안내한다"로 표현했다.
- [x] CHANGELOG Unreleased 항목.

### Test Hardening

- [x] test/agent-kit-install.test.js의 도움말 검사에 새 단계 문구를 더한다. 바꾸기 전에는 실패하고 바꾼 뒤 통과하는지 확인한다.
  도움말 변경 전 1개 실패, 변경 후 설치 테스트 8개 모두 통과.

### Integration Test

- [x] npm run check, npm test, npm run test:platform, 실제 docatlas agents help 출력, 링크 검사. 새 PR을 만든다.
  문법 72개·agent kit 세 쌍, Node 157개 중 154개 통과·3개 건너뜀·실패 0, 플랫폼 6개, pack 45개 파일, 링크 83개 문제 0.

종료 기준: 도움말·README·agent-kit 안내가 같은 내용을 말하고 기존 검사가 통과한다. 기본 설치 동작은 바뀌지 않는다.

후속(2026-10-28 사용자 요청, 같은 PR #4):

- [x] 도움말 5단계: 종료 코드 3이면 건너뛰거나 막힌 파일과 이유를 묻지 않아도 알린다. --force 규칙을 "스스로 붙이지 않는다"로 강화한다.
  agent-kit 안내와 CHANGELOG에도 같은 내용을 반영했다.
- [x] 도움말 테스트에 두 문구를 더하고, 바꾸기 전 실패·바꾼 뒤 통과를 확인한다. npm run check·npm test·플랫폼.
  변경 전 도움말 테스트 1개 실패, 변경 후 설치 테스트 8개 통과. Node 157개 중 154개 통과·3개 건너뜀·실패 0, 플랫폼 6개, pack 45개 파일.

## Claude Code·Codex 밖 에이전트 안내 — 완료(배포 전)

대응: RQ-17·18 / DC-27 / M-16. 같은 PR #4.
진입: 사용자 결정(2026-10-28)을 기준 4종에 기록했다. 기준 커밋 0457172.
기준 관찰: 클라이언트 폴더가 없는 홈에서 install은 "--target claude, codex or all을 고르라"는 오류(종료 2)만 내고,
--target cursor는 허용 목록만 알려 준다. 도움말에는 원본 파일 위치와 다른 에이전트 안내가 없다.

### 구현

- [x] agentsHelp(kit, kitDir)에 다른 에이전트 절과 원본 경로·GitHub 주소. runAgents는 kitDir를 넘긴다.
  설치한 tarball에서 도움말이 그 설치본의 node_modules/docatlas/agent-kit 경로를 보여 주고, 그 아래 세 스킬 폴더가 있다.
- [x] 클라이언트 폴더 없음·알 수 없는 --target 오류에 다른 에이전트 안내 문장.
- [x] agent-kit/README.md 안내, CHANGELOG Unreleased.

### Test Hardening

- [x] 도움말 테스트: 절 제목·GitHub 주소·기본 키트 경로. runAgents의 kitDir가 도움말 경로에 반영되는지. 두 오류의 안내 문장.
  바꾸기 전 3개 실패, 바꾼 뒤 설치 테스트 9개 모두 통과.

### Integration Test

- [x] npm run check, npm test, npm run test:platform, 실제 도움말·오류 출력, 링크 검사.
  문법 72개·agent kit 세 쌍, Node 158개 중 155개 통과·3개 건너뜀·실패 0, 플랫폼 6개, pack 45개 파일, 링크 83개 문제 0.

종료 기준: 다른 에이전트가 도움말이나 오류만 읽고 원본 위치와 할 일을 알 수 있고, Claude Code·Codex 설치 동작은 그대로다.

## 0.3.1 배포 준비 — 완료, 게시 확인

대응: RQ-14·17·18·19 / DC-24~27 / M-11·16·18.
진입: PR #4 병합 후 main 666d55e. 작업 브랜치를 main으로 빨리 감기했다. main의 트리는 마지막 전체 검증 커밋 0061f21과 같다.
기준 검증(0061f21): 문법 72개·agent kit 세 쌍, Node 158개 중 155개 통과·3개 건너뜀·실패 0, 플랫폼 6개, pack 45개 파일.

- [x] manifest·lockfile을 npm version 0.3.1 --no-git-tag-version --ignore-scripts로 갱신한다. CLI --version이 0.3.1을 출력한다.
- [x] CHANGELOG의 Unreleased를 0.3.1로 옮기고 guide/configuration.md의 "next release after 0.3.0"을 0.3.1로 고친다.
- [x] npm run check, npm test, npm run test:platform, npm pack --dry-run, npm publish --dry-run, CLI 버전 출력을 확인한다.
  문법 72개·agent kit 세 쌍, Node 158개 중 155개 통과·3개 건너뜀·실패 0, 플랫폼 6개(설치된 tarball 실행기 포함) 통과.
  pack·publish dry-run: docatlas@0.3.1, 45개 파일, 56.2 kB. publish dry-run은 로그인이 필요하다는 경고만 냈다. 링크 96개 문제 0.
- [x] 사용자 요청으로 준비 커밋을 main에 직접 푸시하고, 사용자가 실행할 게시·확인 명령을 안내한다.

종료 기준: 0.3.1 후보의 파일 구성과 버전 표시가 맞고 검사가 통과한다. 실제 npm publish·태그는 사용자 단계다.

### 사용자가 실행할 0.3.1 배포 절차

준비 커밋의 main 푸시와 CI 통과 뒤 main에서 실행한다. package.json은 이미 0.3.1이므로 npm version을 다시 실행하지 않는다.

```sh
git checkout main
git pull origin main
npm whoami --registry=https://registry.npmjs.org/
npm publish --dry-run --access public --registry=https://registry.npmjs.org/
npm publish --access public --registry=https://registry.npmjs.org/
npm view docatlas version --registry=https://registry.npmjs.org/
npx --yes docatlas@0.3.1 --version
npx --yes docatlas@0.3.1 agents help
```

선택: git tag v0.3.1, git push origin v0.3.1. CHANGELOG의 날짜는 npm 게시일(UTC)이며 다른 날 게시하면 고친다.

게시 확인(2026-10-28): 사용자가 0.3.1을 게시했다. npm view docatlas@0.3.1의 gitHead는 8f6bc69(준비 커밋)다.
태그 v0.3.1과 GitHub 릴리스는 이 세션의 git 프록시가 태그 푸시를 거부(HTTP 403)하고 gh 인증이 없어 사용자가 만든다.
참고: docatlas 저장소 안에서 npx docatlas를 실행하면 레지스트리 패키지가 아니라 그 checkout의 소스가 실행되므로
npm install 전에는 ERR_MODULE_NOT_FOUND(open)가 난다. 레지스트리 버전은 npx --yes docatlas@latest로 실행한다.

## 기본 설치 항목을 세 쌍으로 — 완료(배포 전)

대응: RQ-17·18 / DC-28 / M-16.
진입: 사용자 결정(2026-10-29)을 기준 4종에 기록했다. 기준 커밋 e1f3976.
기준 검증(e1f3976): 문법 72개·agent kit 세 쌍, Node 158개 중 155개 통과·3개 건너뜀(root 권한)·실패 0.
기준 관찰: 임시 HOME에서 --dry-run 미리보기. ~/.claude만 있으면 Claude 2줄, ~/.codex만 있으면 Codex 2줄,
~/.claude와 ~/.agents가 있으면 두 클라이언트 4줄, 아무것도 없으면 종료 2. 모두 designer 한 항목뿐이다.

### 구현

- [x] agent-kit/manifest.json의 implementer·reviewer default를 true로 바꾼다. 원본 내용이 같으므로 버전·해시는 그대로다.
- [x] src/agent-kit/command.js 에이전트용 도움말 1단계를 "일부만 원하면 --only <name>"으로 바꾸고, --all 설명을
  "default가 아닌 항목까지 모두"로 고친다. 항목 목록의 default 표시는 manifest를 그대로 따른다.
- [x] README 빠른 시작·역할 표, METHOD 두 언어판의 도구 안내, agent-kit/README.md 설치 절과 표, CHANGELOG Unreleased.
  agent-kit/README.md에 "0.3.1 이하에서는 designer만 기본이었고, 같은 명령을 다시 실행하면 둘이 추가된다"는 안내를 더했다.

### Test Hardening

- [x] 저장소 kit의 default가 세 항목 모두인지(agent-kit.test.js), 도움말의 새 1단계 문구와 질문 단계 문구가 사라졌는지
  (agent-kit-install.test.js) 확인한다. 바꾸기 전에는 실패하고 바꾼 뒤 통과하는지 본다.
  코드 변경 전 2개 실패, 변경 후 통과. 저장소 kit을 쓰는 테스트 2개(Claude만 있는 HOME의 미리보기 6줄, 기본 선택 세 항목)도 함께 고쳤다.
- [x] 한쪽 클라이언트 폴더만 있는 HOME에서 기본 설치가 그 클라이언트에만 쓰고 다른 클라이언트 폴더를 만들지 않는지
  runAgents 수준에서 확인한다(합성 kit). 감지 동작은 바뀌지 않으므로 바꾸기 전에도 통과해야 한다. 변경 전후 모두 통과.

### Integration Test

- [x] npm run check, npm test, npm run test:platform, npm run test:integration(기본 미리보기 12줄·프로젝트 --all 같은 이름 경고 12개),
  실제 docatlas agents help와 임시 HOME 미리보기, npm pack --dry-run, 링크 검사.
  문법 72개·agent kit 세 쌍, Node 159개 중 156개 통과·3개 건너뜀(root 권한)·실패 0, 플랫폼 6개, 통합 5개 통과.
  통합의 F-07은 이 세션의 Playwright 브라우저 버전이 맞지 않아 PLAYWRIGHT_BROWSERS_PATH로 설치된 Chromium을 가리켜 실행했다.
  실제 도움말 1단계와 항목 세 개 모두 default 표시, ~/.claude만 있는 HOME은 Claude 6줄, ~/.codex만 있는 HOME은 Codex 6줄.
  pack 45개 파일, 바뀐 문서 9개의 링크 56개 문제 0, git diff --check 통과.

종료 기준: 옵션 없는 설치가 감지된 클라이언트에 세 항목을 설치하고, 도움말·README·METHOD·agent-kit 안내가 같은 내용을 말하며
기존 검사가 통과한다. 클라이언트 감지와 --only·--all·--target 동작은 바뀌지 않는다.

## 0.4.0 배포 준비 — 완료, 게시 확인

대응: RQ-17·18 / DC-28 / M-16.
진입: DC-28을 main에 병합했다(c6a66bd). 사용자가 0.4.0으로 버전을 미리 올려 main에 푸시하라고 요청했다(2026-10-29).
기준 검증(ad436b1): 문법 72개·agent kit 세 쌍, Node 159개 중 156개 통과·3개 건너뜀·실패 0, 플랫폼 6개, 통합 5개.

- [x] manifest·lockfile을 npm version 0.4.0 --no-git-tag-version --ignore-scripts로 갱신한다. CLI --version이 0.4.0을 출력한다.
- [x] CHANGELOG의 Unreleased를 0.4.0으로 옮긴다. 날짜는 npm 게시일(UTC)이며 다른 날 게시하면 고친다.
- [x] npm run check, npm test, npm run test:platform, npm run test:integration, npm pack --dry-run, npm publish --dry-run.
  문법 72개·agent kit 세 쌍, Node 159개 중 156개 통과·3개 건너뜀·실패 0, 플랫폼 6개, 통합 5개(F-07은 PLAYWRIGHT_BROWSERS_PATH로
  설치된 Chromium 사용). pack·publish dry-run: docatlas@0.4.0, 45개 파일, 56.4 kB. publish dry-run은 로그인 필요 경고만 냈다.
  바뀐 문서의 링크 29개 문제 0, git diff --check 통과.
- [x] 사용자 요청으로 준비 커밋을 main에 직접 푸시하고, 사용자가 실행할 게시·확인 명령을 안내한다.

종료 기준: 0.4.0 후보의 파일 구성과 버전 표시가 맞고 검사가 통과한다. 실제 npm publish·태그는 사용자 단계다.

### 사용자가 실행할 0.4.0 배포 절차

준비 커밋의 main 푸시와 CI 통과 뒤 main에서 실행한다. package.json은 이미 0.4.0이므로 npm version을 다시 실행하지 않는다.

```sh
git checkout main
git pull origin main
npm whoami --registry=https://registry.npmjs.org/
npm publish --dry-run --access public --registry=https://registry.npmjs.org/
npm publish --access public --registry=https://registry.npmjs.org/
npm view docatlas version --registry=https://registry.npmjs.org/
npx --yes docatlas@0.4.0 agents help
npx --yes docatlas@0.4.0 agents install --dry-run
```

선택: git tag v0.4.0, git push origin v0.4.0. 아직 만들지 않은 v0.3.1(8f6bc69) 태그도 같은 방식으로 만든다.

게시 확인(2026-10-29): 준비 커밋의 main CI(run 40795920052)가 통과했고, 사용자가 0.4.0을 게시했다(00:59 UTC).
npm view docatlas@0.4.0의 gitHead는 fada805이며 latest는 0.4.0이다. 사용자가 태그 v0.3.1(8f6bc69)·v0.4.0(fada805)을 만들었다.
GitHub 릴리스 v0.3.1은 있다. v0.4.0 릴리스 노트는 사용자가 gh release create로 만든다(이 세션에는 gh 인증이 없다).

## 문서 위치 원칙 보강 — 완료(배포 전)

대응: RQ-19 / DC-29 / M-18.
진입: 사용자 결정(2026-10-30)을 기준 4종에 기록했다. 기준 커밋 2127c8c.
기준 검증(2127c8c, macOS 15.6 / Node 22.12.0): 문법 72개·agent kit 1.0.0 세 쌍, Node 159개 통과·실패 0.

### 구현

- [x] METHOD.md 문서 위치 절: 첫 문장의 이유(테스트 비유), 2번 항목의 묶음 규칙, 구조가 불분명할 때의 문단.
- [x] METHOD.ko.md에 같은 변경. 두 문서의 구조(제목 17·목록 51·코드 펜스 6·표 행 23·링크 11)가 같다.
- [x] designer SKILL.md의 Documentation Discovery and Placement에 묶음 규칙과 위치 확인 규칙. metadata.version 1.2.0.
- [x] manifest.json의 designer version 1.2.0·kitVersion 1.1.0, 이전 스킬 해시(a64e7b2e…)를 previous 1.1.0으로, 새 해시(cebb1d14…) 기록.
  agent-kit/README.md 표와 kit 버전, CHANGELOG Unreleased.
- [x] 리뷰(doc-driven-reviewer-v1, 2026-10-30): APPROVE, critical 0·warning 3·suggestion 4.
  warning 3개(CHANGELOG 안내 조건, DESIGN RQ-19 절의 예외 표시, 인계의 커밋 표현)와 스킬의 서브에이전트 문구 suggestion을 반영했다.
  서브에이전트는 제안한 위치에 초안을 두고 위치를 TBD로 표시해 질문을 돌려준다. 배포 전이라 스킬 버전은 1.2.0 그대로이고 해시만 다시 기록했다.
  나머지 suggestion 3개(DC-29 체크리스트 순서, M-18 대응 줄, 출처 제목 표기)는 반영하지 않았다.

### Test Hardening

- [x] npm run check가 새 버전·해시·previous 규칙을 통과한다. manifest를 고치기 전에는 해시 불일치와 metadata.version 불일치로 실패했다.
- [x] 저장소 kit의 버전을 고정한 테스트 2개가 새 버전에서 실패하는 것을 확인하고 기대값을 고쳤다.
  agent-kit-plan.test.js의 kitVersion 1.0.0→1.1.0, agent-kit-install.test.js의 도움말 designer 1.1.0→1.2.0.
  버전 변경을 알아채게 하는 의도된 고정이므로 그대로 둔다.

### Integration Test

- [x] npm run check, npm test, npm pack --dry-run, 임시 HOME에서 실제 docatlas agents install 미리보기와
  kit 1.0.0 설치 기록의 업데이트 안내 확인, 바뀐 문서의 링크 검사, git diff --check.
  문법 72개·agent kit 1.1.0 세 쌍, Node 159개 통과·실패 0, pack 45개 파일·56.6 kB.
  ~/.claude만 있는 임시 HOME에 설치한 뒤 기록을 kit 1.0.0·이전 designer 스킬로 되돌리면 문서 지도가
  "kit 1.1.0 is available (installed 1.0.0)" 안내를 출력했다. 미리보기와 설치는 replace 1(designer 스킬)·unchanged 5이고,
  설치 후 스킬은 1.2.0이며 안내가 사라졌다. 바뀐 문서 9개의 상대 링크 52개 문제 0, git diff --check 통과.
  npm run test:platform·test:integration·test:browser는 제품 코드와 설치 동작이 바뀌지 않아 실행하지 않았다.

종료 기준: METHOD 두 언어판과 designer 스킬이 같은 위치 규칙을 말하고, kit 버전·해시 검사와 기존 테스트가 통과한다.
에이전트 룰·implementer·reviewer·제품 코드는 바뀌지 않는다.

## 0.4.1 배포 준비 — 완료, 게시 확인

대응: RQ-19 / DC-29 / M-17·18.
진입: DC-29를 작업 브랜치 claude/dc-29-placement에 커밋했다(aa4f90c). 사용자가 리뷰 반영 후 바로 배포할 수 있게 버전을 올리라고 요청했다(2026-10-30).
기준 검증(aa4f90c, macOS 15.6 / Node 22.12.0): 문법 72개·agent kit 1.1.0 세 쌍, Node 159개 통과·실패 0.

- [x] manifest·lockfile을 npm version 0.4.1 --no-git-tag-version --ignore-scripts로 갱신한다. CLI --version이 0.4.1을 출력한다.
- [x] CHANGELOG의 Unreleased를 0.4.1로 옮긴다. 날짜는 npm 게시일(UTC)이며 다른 날 게시하면 고친다.
- [x] npm run check, npm test, npm run test:platform, npm run test:integration, npm pack --dry-run, npm publish --dry-run.
  문법 72개·agent kit 1.1.0 세 쌍, Node 159개 통과·실패 0, 플랫폼 6개, 통합 5개. pack·publish dry-run: docatlas@0.4.1, 45개 파일, 56.6 kB.
  통합의 F-07은 이 환경에 Playwright 기본 브라우저가 없어 처음에 실패했고, DOCMAP_BROWSER_CHANNEL=chrome(설치된 Chrome)으로 통과했다.
  agents help는 Kit 1.1.0과 designer 1.2.0 default를 출력한다.
- [x] 사용자 요청으로 작업 브랜치를 main에 fast-forward로 반영해 푸시했고(fcb4e68) 작업 브랜치는 지웠다.
  main CI(run 41004822916)가 macOS·Windows × Node 22·24 네 작업 모두 통과했다.

종료 기준: 0.4.1 후보의 파일 구성과 버전 표시가 맞고 검사가 통과한다. main 반영·실제 npm publish·태그는 사용자 단계다.

### 사용자가 실행할 0.4.1 배포 절차

package.json은 이미 0.4.1이므로 npm version을 다시 실행하지 않는다. main에 반영하고 CI가 통과한 뒤 main에서 게시한다.

```sh
git checkout main
git merge --ff-only claude/dc-29-placement
git push origin main
npm whoami --registry=https://registry.npmjs.org/
npm publish --dry-run --access public --registry=https://registry.npmjs.org/
npm publish --access public --registry=https://registry.npmjs.org/
npm view docatlas version --registry=https://registry.npmjs.org/
npx --yes docatlas@0.4.1 agents help
npx --yes docatlas@0.4.1 agents install --dry-run
```

선택: git tag v0.4.1, git push origin v0.4.1.

게시 확인(2026-10-30): 위 절차의 main 반영과 푸시는 이 세션에서 했다. main CI(run 41004822916)가 통과했고, 사용자가 0.4.1을 게시했다(04:55 UTC).
npm view docatlas@0.4.1의 gitHead는 fcb4e68이며 latest는 0.4.1이다. 사용자가 태그 v0.4.1(fcb4e68)을 만들었다.
GitHub 릴리스 v0.4.1(영문 노트)은 이 세션에서 gh release create --verify-tag로 만들었고 Latest로 표시된다. v0.4.0 릴리스도 있다.

ctxbin 갱신(2026-10-30, 사용자 요청): 원격 스킬 8개·에이전트 3개 전체를 ~/.ctxbin/backups/ctxbin-2026-10-30-before-docatlas-0.4.1.json에
백업한 뒤 doc-driven 세 쌍을 원본과 해시로 비교했다. designer 스킬만 1.1.0(a64e7b2e…)이라 1.2.0 원본으로 저장했고, 다시 받아 cebb1d14…를 확인했다.
implementer·reviewer 스킬과 세 룰은 이미 원본과 같아 다시 저장하지 않았다. ctxbin sync로 설치한 로컬 사본은 갱신하지 않았다.

로컬 설치(2026-10-30, 사용자 요청): ctxbin sync 대신 docatlas@0.4.1 agents install로 사용자 전역 사본을 맞췄다.
미리보기는 unchanged 4(implementer·reviewer 스킬), skip-managed 8(ctxbin 관리 사본)이었다. 8개 중 designer 스킬 2개는 1.1.0이고,
룰 6개는 내용이 같고 표기만 달랐다(ctxbin은 YAML 값에 따옴표, Codex TOML은 escape 문자열). 건너뛴 줄을 사용자에게 보여 주고
사용자가 전부 교체를 고른 뒤에만 --force로 실행했다. 8개를 ~/.docatlas/backups/2026-10-30T05-07-17-275Z/에 백업한 뒤 교체했고,
다시 실행한 미리보기는 unchanged 12, 설치 기록은 12개 모두 kit 1.1.0이다. ctxbin 추적 정보는 남아 있어 ctxbin sync를 실행하면
ctxbin 표기로 되돌아가고 docatlas는 다시 건너뛴다. 사용자에게 한쪽으로만 관리하도록 안내했다.

Confluence 갱신(2026-10-30, 사용자 요청): 사용자의 개인 공간 페이지는 로컬 Markdown 저장소의 게시 명령으로 designer 스킬 1.2.0과
룰 최신 본문(frontmatter 제외)을 올렸고 두 블록이 원본과 해시가 같다. 게시 명령이 저장소 전체를 동기화해 다른 페이지 4개도 다시 저장됐지만
버전 비교에서 내용 차이는 없었고, 이전 버전도 모두 같은 계정이 저장한 것이었다.
팀원이 올린 팀 페이지(v5)는 Atlassian MCP로 원본 코드 절의 스킬·룰 코드 블록 두 개만 노드 단위로 교체해 v6이 됐다.
스킬은 1.2.0 전체로, 룰은 팀원이 정한 이름(doc-driven-designer)과 tools 머리말을 유지하고 본문만 최신으로 바꿨다.
v5→v6 비교에서 바뀐 구간은 그 두 블록뿐이다. 팀 페이지의 다른 절과 갱신일 표시는 바꾸지 않았다.

## 구현 계획의 Refs·Files 표기 — 완료(배포 전)

Refs: RQ-20, DC-30, M-19
진입: 2026-11-01 사용자 결정(Files와 Refs 둘 다, 스킬·룰 포함, 문서부터). 기준 커밋 0373bbc.
기준 검증(0373bbc, Linux / Node 22.23.4): 문법 72개·agent kit 1.1.0 세 쌍, Node 159개 중 156개 통과·3개 건너뜀(root 권한)·실패 0.
이 작업 절부터 [설계의 RQ-20 계약](./DESIGN.md#구현-계획의-refsfiles-표기--rq-20-계약) 형식을 쓴다.
이전 절의 "대응:" 줄과 문장 속 파일 언급은 소급해 고치지 않는다(DC-30 b).

### 기준 문서 — 완료

- [x] 요구사항에 RQ-20과 사용자 결정·배경·설계 제안·범위 밖을 기록했다.
- [x] 설계에 형식·규칙·파싱 계약·역할·바뀌는 파일과 버전 제안을 두고, DC-30을 세 TBD와 함께 열었다.
- [x] 구현 계획에 이 작업 절과 인계를, 수동 검증에 M-19를 더했다.
- [x] 확인: 바뀐 문서의 상대 링크·앵커와 git diff --check. 제품 코드·스킬·룰은 바꾸지 않았다.
- [x] 후속 결정(2026-11-01) 반영: designer만으로 Refs·Files가 동작하고 implementer·reviewer는 강화 개념이다.
  설계의 역할 표, 아래 1단계 작업, M-19를 고쳤다. 이전 제안(Files는 implementer만 쓴다)을 바꿨다.
- [x] DC-30 확정(2026-11-01, 사용자 "추천대로 진행해"): 영어 라벨, 새 작업부터·예제 checkout만, docatlas 검색은 별도 후속. 네 문서의 TBD 표시를 닫았다.

Files:
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### 1단계 — 규칙 원본: 완료

진입: DC-30의 세 TBD가 정해지고 설계의 형식이 확정된다. 2026-11-01 충족.

- [x] METHOD.md 작성 규칙에 Refs·Files 항목과 "Phase records: Refs and Files" 하위 절(이유·예시·규칙 4개)을 더하고,
  문서 세트 표의 IMPLEMENT.md 설명에 두 기록을 넣었다. METHOD.ko.md에 같은 변경("Phase 기록: Refs와 Files").
  두 문서의 구조(이번 일회성 집계로 제목 17·목록 52·코드 블록 4·표 행 23·링크 12)가 같다.
- [x] designer SKILL.md(단독으로 완결): Standard Artifact Flow의 IMPLEMENT.md 항목, 새 Phase Records 절(예시·형식·작성 시점·git 출처·
  영어 라벨·기존 단계는 요청 없이 소급하지 않음), Phase Completion에 단계를 마칠 때 Files 기록과 Refs 확인
  (implementer 사용 여부와 무관), Completion Criteria에 Refs. ID를 줄여 쓰지 않는 규칙은 Working Rules가 아니라 Phase Records에 뒀다. 1.3.0.
- [x] designer 룰: 13번 규칙(Refs 작성, 구현한 단계를 마칠 때 git에서 Files 작성, 예정 파일 금지, 영어 라벨).
- [x] implementer SKILL.md(강화): 단계 시작 때 git status로 기존 변경 기록, 문서 동기화 때 형식을 다시 적은 Files 작성과 Refs 확인,
  범위 밖이면 보고로 반환, 완료 보고 템플릿에 Files. 1.2.0. 룰: 8번 규칙을 넣고 뒤 번호를 하나씩 밀었으며 완료 보고에 Files.
- [x] reviewer SKILL.md(강화): Doc sync에 "문서가 phase 기록을 쓸 때" Refs·Files를 수집한 변경과 비교해 어긋나면 warning.
  여러 단계가 커밋 전이면 블록을 합쳐 비교. 1.5.0. 룰: 12번 규칙.
  기록을 쓰지 않는 기존 프로젝트에 경고가 쏟아지지 않도록 "문서가 기록을 쓸 때"로 한정했다.
- [x] manifest.json: designer 1.3.0·implementer 1.2.0·reviewer 1.5.0, kitVersion 1.2.0. 세 항목의 이전 스킬·룰 파일 해시를 previous로 옮겼다
  (출처: docatlas agent kit 1.0.0~1.1.0, designer 스킬은 1.1.0). agent-kit/README.md 표·kit 버전, CHANGELOG Unreleased.
- [x] README 요약의 문서 표와 규칙은 새 규칙과 모순되지 않아 바꾸지 않았다.
- [x] DC-30 b에 따라 examples/sample-shop/docs/checkout/IMPLEMENT.md의 다섯 단계에 Refs를, 끝난 Phase 1·2에 Files를 넣었다.
  진행 중인 Phase 3에는 Files를 두지 않아 "단계를 마칠 때 쓴다"를 보여 준다. 예제 README의 checkout 설명도 고쳤다. 예제 문서는 21개 그대로다.

기준 테스트: npm run check(버전·해시·previous 규칙), npm test.
결과: 문법 72개·agent kit 1.2.0 세 쌍 통과. npm test는 버전 고정 테스트 2개만 실패해 Test Hardening에서 고쳤다.
종료 기준: METHOD 두 언어판과 세 스킬·룰이 같은 형식과 역할을 말하고 kit 검사와 기존 테스트가 통과한다. 제품 코드는 바뀌지 않는다. 충족했다.

Files:
- `METHOD.md` (modified)
- `METHOD.ko.md` (modified)
- `agent-kit/skills/doc-driven-designer-v1/SKILL.md` (modified)
- `agent-kit/agents/doc-driven-designer-v1.md` (modified)
- `agent-kit/skills/doc-driven-implementer-v1/SKILL.md` (modified)
- `agent-kit/agents/doc-driven-implementer-v1.md` (modified)
- `agent-kit/skills/doc-driven-reviewer-v1/SKILL.md` (modified)
- `agent-kit/agents/doc-driven-reviewer-v1.md` (modified)
- `agent-kit/manifest.json` (modified)
- `agent-kit/README.md` (modified)
- `CHANGELOG.md` (modified)
- `examples/sample-shop/README.md` (modified)
- `examples/sample-shop/docs/checkout/IMPLEMENT.md` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)

### Test Hardening: 완료

- [x] manifest를 고치기 전 npm run check가 오류 9개(metadata.version 불일치 3·해시 불일치 6)로 실패하고, 고친 뒤 통과했다.
- [x] 버전 고정 테스트 2개가 실패하는 것을 확인하고 기대값을 고쳤다. agent-kit-plan.test.js의 kitVersion 1.1.0→1.2.0,
  agent-kit-install.test.js의 도움말 designer 1.2.0→1.3.0. 버전 변경을 알아채게 하는 의도된 고정이므로 그대로 둔다.
- [x] 설계의 파싱 계약 정규식으로 만든 일회성 스크립트(저장소 밖)로 이 작업 절과 예제 checkout에서 Refs·Files를 뽑았다.
  단계·물려받은 Refs·파일·renamed 항목이 기대와 같고, METHOD 두 언어판·designer 스킬·DESIGN의 코드 펜스 예시는 잡히지 않았다.
- [x] 이 작업 절의 Files 블록을 합친 목록이 git status의 변경 19개와 같다.
- [x] designer 스킬·룰만으로 형식·작성 시점·git 출처·영어 라벨을 모두 찾을 수 있다. implementer·reviewer를 참조해야 아는 규칙은 없고,
  두 스킬·룰도 각자 형식을 담고 있다(e1087a8 기준). 분량 정리 뒤 reviewer는 형식을 다시 적지 않고, 앞 단계 변경을 빼는 규칙의
  빈틈은 리뷰에서 찾아 아래 "리뷰 반영"에서 고쳤다.

종료 기준: 형식 오류와 버전 불일치가 검사에서 드러나고, 실제 기록이 파싱 계약으로 정확히 추출된다.
designer만으로 규칙이 완결된다. 충족했다.

Files:
- `test/agent-kit-plan.test.js` (modified)
- `test/agent-kit-install.test.js` (modified)
- `docs/IMPLEMENT.md` (modified)

### Integration Test: 자동 검증 완료

- [x] npm run check, npm test, npm pack --dry-run, 바뀐 문서의 링크 검사, git diff --check.
  Linux / Node 22.23.4: 문법 72개·agent kit 1.2.0 세 쌍, Node 159개 중 156개 통과·3개 건너뜀(root 권한)·실패 0,
  pack 45개 파일·58.7 kB(파일 수 그대로), 바뀐 문서 10개의 상대 링크 34개 문제 0, git diff --check 통과.
- [x] ~/.claude만 있는 임시 HOME에 main(0373bbc, kit 1.1.0)의 agents install로 6개를 설치한 뒤, 새 코드의 미리보기는 replace(recorded) 6이었다.
  문서 지도 시작 시 "kit 1.2.0 is available (installed 1.1.0)" 안내가 나왔고, 설치 후 스킬은 designer 1.3.0이며 안내가 사라졌다.
- [x] 단계 끝 리뷰(doc-driven-reviewer-v1): 사용자가 요청했다(2026-11-01). 결과와 반영은 아래 "리뷰 반영"에 있다.
  위 pack 크기와 임시 HOME 확인은 a824c9b 전 측정이며, 리뷰 반영 뒤 다시 실행한 결과도 그 절에 있다.

npm run test:platform·test:integration·test:browser는 제품 코드와 설치 동작이 바뀌지 않아 실행하지 않았다.
종료 기준: 설치본 갱신과 안내가 기존 kit 변경 때와 같이 동작하고, 패키지 구성이 그대로다. 배포 버전과 시점은 사용자가 정한다.
사람의 M-19 확인(실제 에이전트 세션)은 남아 있다.

Files:
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### 스킬·룰 분량 정리 — 완료

진입: 사용자 우려(2026-11-01) — 강화 기능 때문에 스킬·룰이 길거나 난해해져 기존 동작에 나쁜 영향을 줄까 걱정된다.
측정: designer 스킬이 932→1,275단어(+36%)로 늘었고, 새 규칙 중 한 줄 616자처럼 기존 최장 줄보다 긴 줄이 있었다.

- [x] 동작은 그대로 두고 문장을 줄였다. designer Phase Records는 예시·규칙 3개로, 하위 제목 상속·폴더 항목·블록 재작성·설명 위치 같은
  세부는 METHOD와 설계 계약에만 둔다. Phase Completion 문장, 세 룰의 새 규칙, implementer·reviewer의 새 항목도 줄였다.
- [x] reviewer는 문서의 블록을 git 변경과 비교하므로 형식 전체를 다시 적지 않는다. implementer는 형식을 한 줄로 유지한다. 설계 역할 절에 반영했다.
- [x] 결과(0373bbc 대비 단어 수, 절사): designer 스킬 +21%(1,130), 룰 +16%; implementer 스킬 +11%, 룰 +13%; reviewer 스킬 +4%, 룰 +6%.
  세 스킬의 새 줄은 각 파일의 기존 최장 줄 이하였지만, designer 룰(266자, 기존 194자)과 implementer 룰(297자, 기존 256자)은 더 길었다.
  기존 규칙을 지우지는 않았다. 다만 designer 스킬 Completion Criteria 항목과 implementer 룰의 완료 보고 문장에 새 기록을 더했고
  implementer 룰 번호가 하나씩 밀렸다. (처음 기록은 "모든 줄이 기존 최장 줄 이하, 기존 규칙은 바꾸지 않았다"였고 리뷰가 바로잡았다.)
- [x] 배포 전이라 항목 버전과 kitVersion은 그대로 두고 manifest의 현재 해시만 다시 기록했다. previous 항목은 그대로다.
- [x] npm run check(kit 1.2.0 세 쌍), npm test(159개 중 156개 통과·3개 건너뜀·실패 0).

종료 기준: 동작을 바꾸지 않고 새 스킬·룰 문장이 줄어들며 검사와 테스트가 통과한다. 충족했다.

Files:
- `agent-kit/skills/doc-driven-designer-v1/SKILL.md` (modified)
- `agent-kit/agents/doc-driven-designer-v1.md` (modified)
- `agent-kit/skills/doc-driven-implementer-v1/SKILL.md` (modified)
- `agent-kit/agents/doc-driven-implementer-v1.md` (modified)
- `agent-kit/skills/doc-driven-reviewer-v1/SKILL.md` (modified)
- `agent-kit/agents/doc-driven-reviewer-v1.md` (modified)
- `agent-kit/manifest.json` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)

### 리뷰 반영 — 완료

진입: 사용자가 doc-driven-reviewer-v1 리뷰를 요청했다(2026-11-01). 별도 에이전트가 0373bbc...a824c9b를 읽기 전용으로 리뷰했다.
결과: REQUEST_CHANGES, critical 0·warning 5·suggestion 7. 리뷰어가 npm run check·npm test를 다시 실행해 통과를 확인했고,
Files 블록이 커밋별 실제 변경과 같음을 대조했다.

- [x] W1 앞 단계 변경 빼기의 단서와 방법: designer 스킬에 "단계 시작 때 변경 목록을 적고, 끝에서 이 단계가 다시 바꾸지 않은 파일만 뺀다"를 넣었다.
  METHOD 두 언어판과 implementer 룰 8번에도 같은 단서를 넣었다. designer 룰은 요약이라 두지 않았다(서브에이전트 designer는 구현하지 않고 문서 초안만 쓴다).
  designer 스킬만으로 완결된다.
- [x] W2 새 폴더가 `?? dir/`로 접히는 문제: 스킬·룰·METHOD의 git 명령을 `git status --porcelain -uall`로 바꿨다.
- [x] W3 비소급 규칙과의 충돌: designer Artifact Flow·Completion Criteria를 "new phase"로 좁히고, designer 룰을 13번(Refs, 소급 안 함)과
  14번(Files)으로 나눴다.
- [x] W4 분량 정리의 측정 기록을 실측으로 고쳤다. W5 낡은 근거(형식 담김, 측정 시점)를 고치고 아래처럼 다시 실행했다.
- [x] 반영한 suggestion: designer 룰에 `Files: none`, implementer 룰에 kickoff 목록의 쓰임, 예시(designer·METHOD 두 언어판)에 그 단계의 문서 항목,
  manifest previous에 이전 Codex 변환본 해시 3개(렌더러 codex.js는 0.3.0부터 그대로), 인계의 커밋, 파싱 계약의 펜스 정의.
- [x] 반영하지 않은 suggestion: 단계 도중 커밋한 파일(설계에 알려진 한계 TBD로 기록), test/examples.test.js의 형식 회귀 검사(수집 기능 DC-30 c에서).
- [x] 분량(0373bbc 대비 단어 수): designer 스킬 +24.2%(1,158), 룰 +19.7%; implementer 스킬 +13.2%, 룰 +16.0%; reviewer 스킬 +4.8%, 룰 +6.9%.
  새 줄의 최대 길이: designer 스킬 356자(기존 456), implementer 스킬 300자(기존 309), reviewer 스킬 283자(기존 304), reviewer 룰 192자(기존 265).
  designer 룰 204자(기존 194)와 implementer 룰 346자(기존 256)는 기존보다 길다.
- [x] 다시 실행(Linux / Node 22.23.4): npm run check(kit 1.2.0 세 쌍), npm test(159개 중 156개 통과·3개 건너뜀·실패 0), npm pack --dry-run(45개 파일·58.3 kB).
  ~/.claude와 ~/.codex가 있는 임시 HOME에 main(0373bbc)으로 12개 설치 → 새 미리보기 replace(recorded) 12, 문서 지도 안내 한 줄,
  설치 후 designer 1.3.0·implementer 1.2.0·reviewer 1.5.0, 안내 사라짐. 설치 기록을 지운 Codex 사본 6개는 replace(previous-file) 6.

종료 기준: 리뷰의 warning 5개가 해결되고 검사·테스트·업그레이드 확인을 다시 통과한다. 충족했다(두 번째 리뷰에서 확인).

Files:
- `METHOD.md` (modified)
- `METHOD.ko.md` (modified)
- `agent-kit/skills/doc-driven-designer-v1/SKILL.md` (modified)
- `agent-kit/agents/doc-driven-designer-v1.md` (modified)
- `agent-kit/skills/doc-driven-implementer-v1/SKILL.md` (modified)
- `agent-kit/agents/doc-driven-implementer-v1.md` (modified)
- `agent-kit/manifest.json` (modified)
- `CHANGELOG.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### 참고 기록임을 알리기 — 완료

진입: 사용자 우려(2026-11-01) — 예전에 완성된 문서에는 Files 기록이 없다. 새 방식이 자리 잡기 전에는 두 종류가 섞여 있어,
특정 파일과 관련된 문서를 찾아 달라고 하면 에이전트가 모든 단계에 기록이 있다고 오해해 관련 문서를 빠뜨릴 수 있다.
결정: Refs·Files는 참고 기록일 뿐 전체 색인이 아니라고 알린다. 기준 문서(요구사항·설계 성격 규칙·DC-30·M-19)를 먼저 고쳤다.

- [x] designer 스킬 Phase Records에 한 줄: 기록은 검색 보조이며 전체 색인이 아니다, 예전 단계에는 없다, 파일·ID로 문서를 찾을 때 본문도 검색한다.
  designer 룰 15번에 같은 뜻. implementer·reviewer는 관련 문서 찾기를 맡지 않아 바꾸지 않았다.
- [x] 스킬 없이 문서 검색을 부탁받은 에이전트도 알 수 있게 METHOD 두 언어판의 Phase 기록 절과 AGENTS.md 예시, 예제 AGENTS.md,
  이 저장소 AGENTS.md(RQ-20 이전 절에는 기록이 없다는 안내)에 한 줄씩 넣었다. CHANGELOG Unreleased에도 적고 문단을 정리했다.
- [x] 분량(0373bbc 대비 단어 수): designer 스킬 +27.1%(1,185), designer 룰 +27.3%(336). 배포 전이라 버전은 그대로, 해시만 다시 기록했다.
- [x] 확인(Linux / Node 22.23.4): npm run check(kit 1.2.0 세 쌍), npm test(159개 중 156개 통과·3개 건너뜀·실패 0),
  METHOD 두 언어판 구조 동일(이번 일회성 집계로 제목 17·목록 53·코드 블록 4·표 행 23·링크 12), 바뀐 문서의 상대 링크 29개 문제 0,
  파싱 계약으로 이 작업 절의 하위 단계 7개 추출, git diff --check 통과.

종료 기준: 스킬을 쓰든 AGENTS.md 안내만 있든 에이전트가 기록이 참고용임을 읽을 수 있고, 검사와 테스트가 통과한다. 충족했다.
실제 세션 확인은 M-19에 남아 있다.

Files:
- `AGENTS.md` (modified)
- `METHOD.md` (modified)
- `METHOD.ko.md` (modified)
- `CHANGELOG.md` (modified)
- `agent-kit/skills/doc-driven-designer-v1/SKILL.md` (modified)
- `agent-kit/agents/doc-driven-designer-v1.md` (modified)
- `agent-kit/manifest.json` (modified)
- `examples/sample-shop/AGENTS.md` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### 두 번째 리뷰 반영 — 완료

진입: 사용자가 리뷰를 한 번 더 요청했다(2026-11-01). 별도 에이전트가 a824c9b...HEAD를 중심으로 읽기 전용 리뷰를 했다.
결과: REQUEST_CHANGES, critical 0·warning 3·suggestion 8. 첫 리뷰의 W1~W5와 반영했다는 suggestion은 모두 해결로 확인했다
(리뷰어가 check·test·해시·파싱·단어 수·줄 길이를 다시 쟀고, Codex previous 해시를 0373bbc·fcb4e68의 룰로 다시 계산했다).

- [x] W1 기존 동작이 좁아진 것: designer Completion Criteria의 "모든 단계에 진입·기준 테스트·종료 기준"을 되살리고 Refs만 새 단계로 한정했다.
  ade4291에서 "new"가 항목 전체에 붙어 기존 기준까지 새 단계로 좁아졌던 실수다.
- [x] W2 CHANGELOG의 역할 설명을 W1 수정 뒤 상태로 고쳤다(designer가 앞 단계 파일도 빼고, implementer는 같은 규칙에 보고를 더함).
- [x] W3 참고 기록 단계의 [x]에 실제 결과를 적었다.
- [x] 반영한 suggestion: "When you start implementing it"(계획 시점과 구분), "the document text", DESIGN의 designer 룰 설명을 실제(요약)와 맞춤,
  여러 세션에 걸친 단계의 한계를 TBD에 추가, M-19 검색 항목을 스킬 명시 호출과 AGENTS.md만 있는 경우로 나눔,
  CHANGELOG에 METHOD의 AGENTS.md 예시를 복사한 사용자에게 새 줄을 옮기라는 안내, 후속 검색 기능 동작을 설계 제안으로 표시,
  REQUIREMENTS 인수 기준·구현됨 줄에 참고 기록 안내, 인계의 낡은 수치·문장, MANUAL의 측정 시점, 세 하위 단계의 종료 기준.
- [x] 분량(0373bbc 대비 단어 수): designer 스킬 +27.8%(1,191), designer 룰 +27.7%(337). 새 줄 최대 356자(스킬, 기존 456)·204자(룰, 기존 194).
  배포 전이라 버전은 그대로, 해시만 다시 기록했다.
- [x] 확인(Linux / Node 22.23.4): npm run check(kit 1.2.0 세 쌍), npm test(159개 중 156개 통과·3개 건너뜀·실패 0),
  METHOD 두 언어판 구조 동일(제목 17·목록 53·코드 블록 4·표 행 23·링크 12), 바뀐 문서의 상대 링크 29개 문제 0,
  파싱 계약으로 하위 단계 8개 추출, 이 블록과 git status의 변경 8개가 같음, git diff --check 통과.

종료 기준: 두 번째 리뷰의 warning 3개가 해결되고 검사·테스트가 통과한다. 충족했다.

Files:
- `CHANGELOG.md` (modified)
- `agent-kit/skills/doc-driven-designer-v1/SKILL.md` (modified)
- `agent-kit/agents/doc-driven-designer-v1.md` (modified)
- `agent-kit/manifest.json` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

## 0.4.2 배포 준비 — 완료, 게시 확인

Refs: RQ-20, DC-30, M-17, M-19
진입: RQ-20을 작업 브랜치 ccr-9dd9ad4c-9qnhod에 커밋했다(81dce98, 리뷰 두 번 반영). 사용자가 0.4.2로 main 반영과 배포 준비를 요청했다(2026-11-01).
기준 검증(81dce98, Linux / Node 22.23.4): 문법 72개·agent kit 1.2.0 세 쌍, Node 159개 중 156개 통과·3개 건너뜀·실패 0.

- [x] manifest·lockfile을 npm version 0.4.2 --no-git-tag-version --ignore-scripts로 갱신했다. CLI --version이 0.4.2를 출력한다.
- [x] CHANGELOG의 Unreleased를 0.4.2 — 2026-11-01로 옮겼다. 날짜는 npm 게시일(UTC)이며 다른 날 게시하면 고친다.
- [x] npm run check, npm test, npm run test:platform, npm run test:integration, npm pack --dry-run, npm publish --dry-run.
  문법 72개·agent kit 1.2.0 세 쌍, Node 159개 중 156개 통과·3개 건너뜀(root 권한)·실패 0, 플랫폼 6개, 통합 5개.
  pack·publish dry-run: docatlas@0.4.2, 45개 파일, 58.3 kB, latest·public. 레지스트리의 latest는 아직 0.4.1이다.
  통합의 F-07은 처음에 실패했다. 이 작업 환경에 고정 버전(@playwright/test 1.64.1)이 찾는 브라우저 1248번이 없고 1243번만 있어서다.
  임시 폴더에 1243번을 1248번 이름으로 링크하고 PLAYWRIGHT_BROWSERS_PATH로 지정해 통과했다. 저장소 코드는 바꾸지 않았다.
- [x] agents help가 Kit 1.2.0과 designer 1.3.0·implementer 1.2.0·reviewer 1.5.0 default를 출력한다.
- [x] 사용자 요청으로 작업 브랜치를 main에 fast-forward로 반영해 푸시했다(337200b, PR 없음). 작업 브랜치는 지우지 않았다.
  main CI(run 41265141901)가 macOS·Windows × Node 22·24 네 작업 모두 통과했다(check·test:platform·test:browser·pack).

종료 기준: 0.4.2 후보의 파일 구성과 버전 표시가 맞고 검사가 통과하며 main에 반영된다. main CI 확인·실제 npm publish·태그는 그다음 단계다.

Files:
- `package.json` (modified)
- `package-lock.json` (modified)
- `CHANGELOG.md` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### 0.4.2 게시 절차 — 태그 푸시(RQ-21)

2026-11-01 사용자 결정으로 0.4.2는 직접 npm publish 대신 GitHub Actions(Publish to npm)가 게시한다. package.json은 이미 0.4.2다.
Trusted Publisher 등록(사용자 단계)이 끝난 뒤, publish.yml이 들어간 main 커밋에 태그를 건다.

```sh
git checkout main
git pull --ff-only origin main
git tag v0.4.2
git push origin v0.4.2
npm view docatlas version --registry=https://registry.npmjs.org/
npx --yes docatlas@0.4.2 agents help
```

이전 방식(사용자가 main에서 npm publish)은 Trusted Publisher 등록이 끝내 안 될 때의 대안으로만 남긴다.
2026-11-02(UTC) 이후에 게시하면 CHANGELOG의 날짜를 고친다.

## npm 게시 자동화 — 완료, 0.4.2 게시

Refs: RQ-21, DC-31, M-20
진입: 2026-11-01 사용자 결정(Trusted Publishing, 태그 푸시로 게시, 0.4.2부터). 기준 커밋 1eb7c39(작업 브랜치), main은 337200b.
기준 검증(1eb7c39, Linux / Node 22.23.4): 문법 72개·agent kit 1.2.0 세 쌍, Node 159개 중 156개 통과·3개 건너뜀·실패 0.

### 구현

- [x] `.github/workflows/publish.yml`: 태그 `v*` 푸시는 게시, 수동 실행은 dry-run. ubuntu-latest·Node 24·registry-url, 워크플로 기본 contents: read와
  게시 작업의 id-token: write, concurrency, 전체 이력 checkout, main 포함·태그 버전 확인, npm 11.5.1 미만일 때만 npm@11 설치,
  npm ci·check·test·pack dry-run 뒤 게시(또는 리허설). actions 버전은 Platform checks와 같은 checkout@v7·setup-node@v7.
- [x] CONTRIBUTING.md에 "Releasing" 절(버전 올리기, CI 통과 뒤 태그 푸시, 수동 리허설, Trusted Publisher 등록과 npm trust 대안, 실패 처리)을 뒀다.
- [x] 0.4.2 배포 절의 사용자 절차를 태그 푸시 방식으로 바꿨다. 직접 publish는 등록이 끝내 안 될 때의 대안으로만 남겼다.

기준 테스트: YAML 구문 확인, npm run check.
결과: pyyaml로 구문과 트리거(push tags·workflow_dispatch)·권한·단계 순서를 확인했다. npm run check(kit 1.2.0 세 쌍),
npm pack --dry-run 45개 파일·58.3 kB, .github는 패키지에 없다. CONTRIBUTING·기준 문서 링크 문제 0, git diff --check 통과.
종료 기준: workflow와 안내가 설계 계약과 같고 패키지 구성(45개 파일)이 그대로다. 충족했다.

Files:
- `.github/workflows/publish.yml` (added)
- `CONTRIBUTING.md` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### Test Hardening

- [x] 게시 대상 확인 단계를 workflow에서 그대로 뽑아 bash -e로 재현했다(이 저장소, origin/main 337200b).
  337200b + 태그 v0.4.2는 통과, 337200b + 태그 v0.4.1은 "does not match" 실패, main에 없는 1eb7c39 + v0.4.2는 "is not on main" 실패,
  수동 실행(브랜치 main, 337200b)은 통과.
- [x] npm 버전 판정: 10.9.4·11.4.2·11.5.0은 낮음(npm@11 설치), 11.5.1·11.15.0·12.0.0은 충분.

종료 기준: 잘못된 태그나 커밋에서 게시 단계까지 가지 않는다. 충족했다.

Files: none

### Integration Test

- [x] 작업 브랜치를 main에 fast-forward로 반영했다(556d0f0). Platform checks(run 41276800138)가 macOS·Windows × Node 22·24 모두 통과했다.
- [x] main에서 수동 실행(run 41276806056)이 통과했다. ubuntu-latest, Node 24.22.1·npm 11.19.1(업그레이드 불필요), 게시 대상 확인
  "docatlas@0.4.2 from 556d0f0 (main)", npm ci·check(kit 1.2.0 세 쌍)·test(159개 모두 통과)·pack(45개 파일·58.3 kB),
  Publish 단계는 건너뜀, npm publish --dry-run "Publishing to https://registry.npmjs.org/ with tag latest and public access (dry-run)".
- [x] 사용자가 Trusted Publisher를 등록한 뒤 `v0.4.2` 태그를 푸시했고 workflow가 0.4.2를 게시했다(M-20).
  2026-11-01 run 41277271628(태그 v0.4.2, 556d0f0, 05:31~05:32 UTC) 성공. npm latest 0.4.2, gitHead 556d0f0, dist.attestations에 SLSA provenance v1.
  빈 폴더의 npx --yes docatlas@0.4.2 --version이 0.4.2, agents help가 Kit 1.2.0과 designer 1.3.0·implementer 1.2.0·reviewer 1.5.0 default.
  이 세션의 git 연결은 태그 푸시를 HTTP 403으로 거절해 태그는 사용자가 푸시했다.

종료 기준: 0.4.2가 이 workflow로 게시되고 레지스트리의 latest가 0.4.2다. 충족했다.

Files:
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

## 개인 문서와 백업 — Integration Test 자동 검증 완료

Refs: RQ-22, RQ-23, DC-32, DC-33, DC-34, DC-35, DC-36, M-21, M-22
진입: 2026-11-01 사용자 요청과 DC-32 선택. 기준 커밋 df7748f(main·작업 브랜치).
기준 검증: 각 구현 단계를 시작할 때 실행한다. 직전 기록은 npm run check(kit 1.2.0 세 쌍), npm test(159개 중 156개 통과·3개 건너뜀·실패 0).
2026-11-01 사용자가 DC-33~36을 "전부 추천대로" 정했다.

### 기준 문서 — 완료

- [x] 요구사항에 RQ-22·23과 사용자 설명·선택·범위 밖, 설계에 구조·git 숨김·명령·백업·문서 지도·스킬 제안과 DC-32~36을 적었다.
- [x] 구현 계획에 이 절을, 수동 검증에 F-10과 M-21·M-22를 더했다.

Files:
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### 1단계 — 위치 준비와 git 숨김: 완료

진입: DC-33~36 확정. 2026-11-01 충족.

기준 검증(e7d5ade, Linux / Node 22.23.4): 문법 72개·agent kit 1.2.0 세 쌍, Node 159개 중 156개 통과·3개 건너뜀·실패 0.
(처음 기록은 "문법 76개"였다. 구현을 시작한 뒤에 잰 값이라 리뷰가 바로잡았다.)

- [x] `src/private/`(git.js·folder.js·command.js·index.js): 루트의 `.docatlas/private/` 경로와 심볼릭 링크·비폴더 차단,
  `git rev-parse --show-toplevel`·`--git-path info/exclude`로 숨김 파일과 패턴(루트가 하위 폴더면 그 경로 포함, `\ * ? [ ]` 이스케이프),
  `git check-ignore -q -- .docatlas/private/`로 숨김 여부, `git ls-files`로 추적 파일 감지. exclude는 주석 한 줄과 패턴을 덧붙이고
  기존 내용·줄바꿈(CRLF)·권한을 지키며 임시 파일 후 이름 변경으로 쓴다. git이 없거나 저장소가 아니면 경고만 한다.
  (리뷰 반영에서 바뀜: 하위 폴더 패턴과 이스케이프는 없앴고 항상 저장소 최상위를 쓴다. git을 확인할 수 없으면 종료 3이다.)
- [x] `docatlas private init|status|help`: 탭 구분 결과 줄, init `--dry-run`, 종료 코드 0·1·2·3(agents와 같음), 대화형 입력 없음.
  init은 추적된 개인 파일·심볼릭 링크가 있으면 아무것도 쓰지 않고 3. status는 tracked·exposed(숨기지 않은 문서)·blocked면 3.
  CLI 도움말에 두 줄을 더했다. 수집기·서버·화면·agent-kit은 바꾸지 않았다.

기준 테스트: 임시 git 저장소(일반·worktree·git 아님)에서 init 반복 실행 시 exclude 한 줄 유지, 추적된 개인 파일이면 멈춤, agents.json은 숨기지 않음.
결과: test/private.test.js 11개 통과. 첫 init과 재실행(한 줄 유지), agents.json만 git status에 보임·.gitignore 없음, dry-run 무쓰기,
추적 파일 차단, 숨기지 않은 문서 exposed, git 아님·git 없음 경고, 한글·공백·대괄호 하위 루트의 이스케이프 패턴, worktree의 공유 exclude,
CRLF·권한·임시 파일 정리, 심볼릭 링크 차단, 도움말·잘못된 사용 2, docatlas 명령 연결.
npm run check 문법 77개·kit 세 쌍, npm test 170개 중 167개 통과·3개 건너뜀·실패 0, npm pack --dry-run 49개 파일·61.8 kB(src/private/ 4개 추가).
종료 기준: 개인 문서 폴더가 git status에 나타나지 않고 .gitignore와 추적 파일이 바뀌지 않는다. 충족했다.
Windows는 Platform checks가 npm test를 돌리지 않아 이 테스트를 아직 실행하지 않았다(Test Hardening에서 다룬다).

Files:
- `src/private/git.js` (added)
- `src/private/folder.js` (added)
- `src/private/command.js` (added)
- `src/private/index.js` (added)
- `src/cli.js` (modified)
- `test/private.test.js` (added)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### 1단계 리뷰 반영 — 완료

진입: 사용자 요청으로 doc-driven-reviewer-v1이 e7d5ade...6aea538을 리뷰했다(2026-11-01). REQUEST_CHANGES, critical 0·warning 10·suggestion 9.
리뷰의 질문 중 "하위 폴더에서 실행하면 어디에 두나"는 사용자가 "항상 저장소 최상위"를 골랐다. "git을 확인할 수 없으면 종료 3"과
"노출 판정은 모든 파일"은 안전한 쪽으로 정했다. 문서 지도 안내·복구 질문은 사용자가 대화에서 직접 승인한 항목이라 그대로 둔다.

- [x] 위치: git 안이면 실행 위치와 관계없이 저장소 최상위를 쓰고 패턴은 항상 `/.docatlas/private/`다. 결과 첫 줄에 `root <폴더>`를 낸다.
  하위 폴더 패턴과 그 이스케이프는 없앴다.
- [x] git 질의에서 GIT_DIR 등 저장소 변수를 지운다(hook 안에서 다른 저장소의 exclude에 쓰던 문제). `--is-inside-work-tree`를 함께 확인한다.
  (재리뷰에서 bare 저장소가 확인에 걸리지 않음을 찾아 고쳤다. 아래 "1단계 재리뷰 반영".)
- [x] git 오류와 git 밖을 나눈다: `.git`이 위에 없으면 not-git 경고, 있으면 git-missing(실행 불가, ENOENT·EACCES 등)·git-error·not-work-tree로 종료 3.
  ls-files·check-ignore가 실패하면 성공으로 넘기지 않고 오류로 끝낸다(종료 1).
- [x] init이 쓴 뒤 check-ignore로 확인하고, `.gitignore`의 `!` 규칙 등으로 여전히 보이면 not-ignored로 종료 3. status는 이때 init 반복 대신 사용자 확인을 안내한다.
- [x] 노출 판정을 모든 파일로 하고 status에 files 줄을 더했다. 폴더가 막혔으면 git 확인을 건너뛰고 blocked 줄을 낸다(git이 링크 너머 경로를 거부한다).
- [x] exclude를 바이트로 읽고 덧붙인다(UTF-8이 아닌 기존 줄 보존). 권한은 쓴 뒤 chmod로 맞춘다(umask 영향 제거). `info` 폴더가 링크면 멈춘다.
  폴더를 만들기 직전에 다시 확인한다. 경로 끝 공백을 지우던 trim을 없앴다. 잘못된 주석(exclude.js)을 고쳤다.
- [x] 도움말: 최상위 규칙, 모든 blocked 이유, files·tracked `-`, 종료 3의 뜻. 테스트가 옵션 목록을 양방향으로 대조한다
  (status 요약 대조는 순환 검사였다. 재리뷰 반영에서 모든 status 실행의 요약이 문서화된 값인지 확인하도록 바꿨다).
- [x] 테스트 격리: 빈 전역 git 설정·시스템 설정 끄기·GIT_CEILING_DIRECTORIES·저장소 변수 제거·commit.gpgsign=false. 바깥 저장소를 건드리지 않는다.
  새 테스트: 하위 폴더→최상위, .md가 아닌 파일 노출, `!` 규칙, git 밖의 git 없음, 저장소 안의 git 없음·git 오류(가짜 git), GIT_DIR·GIT_WORK_TREE 무시,
  submodule, 바이트·CRLF·마지막 줄바꿈·0o664 권한, exclude 파일 없음, `.docatlas` 링크·private 파일·info 링크, 쓰기 실패 시 임시 파일 정리.
- [x] 문서: DESIGN의 git 숨김·명령 절에 구현된 계약과 "1단계 구현" 표시, 종료 3 설명(388행) 수정, 보관 개수 확정 반영,
  REQUIREMENTS 모듈 표와 최상위 결정, MANUAL의 "제안" 표기와 모노레포 항목, 기준 검증 숫자(76→72).
- [ ] 반영하지 않음: 동시 실행 잠금과 검사·쓰기 사이의 완전한 재확인(Test Hardening에서 정한다), Windows 실행(Test Hardening),
  CHANGELOG 줄(main에 반영할 때 더한다).

결과: test/private.test.js 15개. root로는 14개 통과·1개 건너뜀(권한 테스트), nobody 사용자로는 15개 모두 통과.
npm run check 문법 77개·kit 세 쌍, npm test 174개 중 170개 통과·4개 건너뜀·실패 0, npm pack --dry-run 49개 파일·63.3 kB.
종료 기준: 리뷰의 warning이 해결되거나 이유와 함께 남고 검사가 통과한다. 충족했다.

Files:
- `src/private/git.js` (modified)
- `src/private/folder.js` (modified)
- `src/private/command.js` (modified)
- `src/private/index.js` (modified)
- `test/private.test.js` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### 1단계 보완 — git 밖의 루트 찾기: 완료

진입: 사용자 질문(git 저장소가 아니면 실행 위치를 루트로 보나)에 답하고, 이미 있는 루트 전용 폴더를 루트로 보게 하자는 사용자 선택(2026-11-01).

- [x] git 밖이면 시작 폴더부터 위로 실제 폴더인 `.docatlas/private/`를 찾아 그 폴더를 루트로 쓴다. 홈 폴더와 그 위는 보지 않고,
  `.docatlas`·`private`이 링크인 폴더는 건너뛴다. 없으면 시작 폴더(folder.js의 findPrivateRoot, runPrivate의 home 옵션).
  (재리뷰에서 홈 밖 시작 시 `/`까지 올라가는 문제를 찾아 규칙을 바꿨다. 아래 "1단계 재리뷰 반영".)
- [x] 도움말의 루트 설명과 `--root` 설명, 설계·요구사항·M-21에 같은 규칙을 적었다.
- [x] 테스트: 기록이 없을 때 시작 폴더, 위쪽 프로젝트의 개인 폴더를 찾아 하위 폴더에 새로 만들지 않음, `--root`도 같음, 홈 폴더의 `.docatlas/private`은 쓰지 않음.

결과: test/private.test.js 16개 중 15개 통과·1개 건너뜀(root 권한), npm test 175개 중 171개 통과·4개 건너뜀·실패 0, npm run check 통과.
종료 기준: git 밖에서도 하위 폴더 실행이 개인 폴더를 흩뜨리지 않는다. 충족했다.

Files:
- `src/private/folder.js` (modified)
- `src/private/command.js` (modified)
- `src/private/index.js` (modified)
- `test/private.test.js` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### 1단계 재리뷰 반영 — 완료

진입: 사용자 요청으로 doc-driven-reviewer-v1이 6aea538...a0ec443을 다시 리뷰했다(2026-11-01). REQUEST_CHANGES, critical 2·warning 4·suggestion 7.
첫 리뷰의 W1~W10은 해결 또는 이유와 함께 미룸으로 확인됐다(W3·W7은 아래 C1·W3로 일부 남았다).
사용자 선택: git 밖 위로 찾기는 홈 안에서만, 홈 폴더와 그 위는 막고 알린다.

- [x] C1 bare 저장소·그 하위·`.git` 안이 git 밖으로 판정되던 문제: git이 `false`를 출력한 뒤 실패하므로 첫 줄을 성공·실패와 관계없이 읽어 not-work-tree로 막는다.
- [x] C2 홈 밖에서 시작하면 `/`까지 올라가 다른 사용자의 폴더를 쓰거나 EACCES로 막히던 문제: 위로 찾기는 시작 폴더가 홈 안일 때만 하고,
  `.docatlas` 항목이 있는 가장 가까운 폴더에서 멈춰 그 폴더를 루트로 쓴다(사용자 결정의 "다른 프로젝트의 .docatlas에서 멈춤"을 이렇게 구현했다).
  홈 밖이면 시작 폴더를 쓴다. (같은 날 단순화에서 위쪽 찾기 자체를 없앴다. 아래 "1단계 단순화".)
- [x] 홈 막기: 정해진 루트가 홈 자체나 그 위면(홈이 git 최상위인 dotfiles 포함) `blocked home`, 종료 3, 아무것도 쓰지 않는다.
- [x] git 밖 판정을 git과 맞췄다: 유효한 `.git`만(HEAD가 있는 폴더, `gitdir:` 파일), GIT_CEILING_DIRECTORIES를 실제 경로로, 파일 시스템 경계에서 멈춤.
  (같은 날 단순화에서 이 재구현을 없애고 git의 "not a git repository" 답을 그대로 쓴다.)
- [x] 테스트 격리: 모든 실행에 테스트용 빈 home을 준다(실제 홈과 TMPDIR 위의 폴더가 결과를 바꾸지 않는다).
- [x] 반영한 suggestion: exclude 줄 비교는 뒤 공백만 무시, 새 private 폴더 0700(sudo 실행 시 소유자 문제는 알려진 한계로 기록),
  `--dry-run`도 패턴 줄이 있으면 숨김을 미리 확인, 도움말을 명령별 blocked 이유로 정리, 모든 status 실행의 요약이 문서화된 값인지 확인,
  DC-32에 git 밖 규칙 추가, 1단계 항목에 바뀐 동작 표시.
- [x] 새 테스트: 홈 안 찾기(가장 가까운 `.docatlas`가 루트, agents.json만 있는 안쪽 프로젝트는 자기 루트, 위쪽 링크는 막힘), 홈 밖 시작은 찾지 않음,
  홈·홈 위·dotfiles 막기, 위쪽 `.docatlas`를 읽을 수 없으면 종료 1·쓰기 없음, bare·hooks·`.git` 안, 빈 `.git`은 저장소 아님,
  exclude 앞·뒤 공백, dry-run의 not-ignored 예측, 0700 권한.
- [ ] 반영하지 않음: 파일 시스템 경계와 심볼릭 링크 ceiling은 코드만 바꾸고 테스트는 없다(환경을 만들기 어렵다). Windows 실행과 동시 실행 잠금은 Test Hardening.

결과: test/private.test.js 24개. root로는 22개 통과·2개 건너뜀(권한 테스트), nobody 사용자로는 24개 모두 통과.
npm run check 문법 77개·kit 세 쌍, npm test 183개 중 178개 통과·5개 건너뜀·실패 0, npm pack --dry-run 49개 파일·64.5 kB.
종료 기준: 재리뷰의 critical·warning이 해결되거나 이유와 함께 남고 검사가 통과한다. 충족했다.

Files:
- `src/private/git.js` (modified)
- `src/private/folder.js` (modified)
- `src/private/command.js` (modified)
- `src/private/index.js` (modified)
- `test/private.test.js` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### 1단계 단순화 — 완료

진입: 사용자 우려(2026-11-01) — 규칙이 복잡해졌고 Windows 사용자가 걱정된다. 그때까지 개인 문서 테스트는 Windows에서 한 번도 돌지 않았다
(Platform checks가 npm test를 실행하지 않는다). 사용자는 git 밖 규칙을 "실행한 폴더로 단순화"로 골랐다.

- [x] git 밖이면 실행한 폴더(또는 `--root`)가 루트다. 위쪽 찾기(findPrivateRoot)를 없앴다. 홈과 그 위 막기는 그대로다.
- [x] git 밖 판단을 git에게 맡겼다. git을 LC_ALL=C·LANGUAGE=C로 실행하고 "not a git repository"면 git 밖, 그 밖의 오류는 git-error.
  유효한 `.git`·탐색 제한·디스크 경계를 우리 코드로 다시 구현하던 부분을 없앴다(git.js 108줄 → 78줄). git을 실행할 수 없을 때만
  위쪽에 `.git` 항목이 있는지 보고 git-missing과 git 밖을 나눈다.
- [x] 홈 비교를 경로 비교(path.relative)로 바꿔 Windows 대소문자 차이에 강하게 했다.
- [x] Windows 확인: test/private.test.js를 `npm run test:platform`에 넣어 Platform checks(macOS·Windows × Node 22·24)가 실행한다.
  셸 스크립트 가짜 git·POSIX 권한·0700 테스트는 Windows에서 건너뛴다. CONTRIBUTING의 플랫폼 검사 설명에 한 줄을 더했다.
- [x] 테스트: 위쪽 찾기 테스트 3개를 없애고, git 밖은 시작 폴더(부모에 개인 폴더가 있어도), 읽을 수 없는 `.docatlas`는 종료 1·쓰기 없음,
  git의 "not a git repository" 답은 경고·그 밖 오류는 git-error를 더했다.

결과: test/private.test.js 24개. root로는 22개 통과·2개 건너뜀, nobody로는 24개 모두 통과. npm run test:platform 30개 중 28개 통과·2개 건너뜀.
npm run check 통과, npm test 183개 중 178개 통과·5개 건너뜀·실패 0, npm pack --dry-run 49개 파일·63.9 kB.
Windows 결과: 작업 브랜치에서 Platform checks를 수동 실행했다(run 41286187387, cf2e790). macOS·Windows × Node 22·24 네 작업 모두 성공.
Windows Node 22(Windows Server 2025, git 2.56.0.windows.4)의 test:platform은 30개 중 26개 통과·4개 건너뜀·실패 0이다.
개인 문서 테스트 24개 중 20개가 Windows에서 실행돼 통과했고(worktree·submodule·CRLF·홈 막기·bare·링크 포함),
건너뛴 4개는 POSIX 권한(2)·셸 스크립트 가짜 git(1)·0700 권한(1) 테스트다.
종료 기준: 규칙이 "git 안이면 저장소 최상위, 밖이면 실행한 폴더, 홈은 막음"으로 줄고 macOS·Windows CI가 개인 문서 테스트를 실행한다.

Files:
- `src/private/git.js` (modified)
- `src/private/folder.js` (modified)
- `src/private/command.js` (modified)
- `src/private/index.js` (modified)
- `test/private.test.js` (modified)
- `package.json` (modified)
- `CONTRIBUTING.md` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### 2단계 — 문서 지도의 Private 그룹: 완료

진입: 1단계 완료(단순화 cf2e790, Windows CI 통과). 사용자가 2단계 진행을 요청했다(2026-11-01).
기준 검증(58c71f5, Linux / Node 22.23.4): npm run check 통과, npm test 183개 중 178개 통과·5개 건너뜀·실패 0.

- [x] 수집기: 경로 규칙 `isPrivatePath`·`PRIVATE_FOLDER`(policy.js)를 두고, 메인 탐색은 `.docatlas/private`를 건너뛰며, 별도 탐색(walkPrivate)이
  루트의 `.docatlas/private` 아래 모든 `.md`를 모은다. 문서 수집은 collect 함수 하나로 묶었다. `acceptsPath`는 개인 경로에 제외·ignore를 적용하지 않는다.
  그룹: Private 그룹은 부모 `.`, 제목 Private 고정, 루트 하위 목록 맨 뒤, groups 설정 미적용. 문서·그룹에 `isPrivate: true`.
- [x] 서버: 읽기 검사(files.js inspect)가 같은 규칙으로 개인 경로를 허용한다. 실시간 감지는 acceptsPath를 쓰므로 그대로 개인 폴더를 본다.
  검색 결과에 `isPrivate`를 싣는다.
- [x] 화면: Private 그룹 줄의 "Only on this computer" 배지와 개인 그룹 줄의 옅은 왼쪽 선, 문서 머리의 Private 배지(`#document-private`), 검색 결과의 Private 배지.
- [x] 사용 가이드: document-map(Private 그룹과 `docatlas private init`), configuration(기본 제외의 예외).

기준 테스트: npm test(수집기·서버), npm run test:browser(지도·검색 배지).
결과: test/private-map.test.js 6개(그룹 구조·맨 뒤·제목 고정, include/exclude/--all-md/--docs-dir/.gitignore/groups 무시와 중복 없음,
`.docatlas` 하위 링크 경고, 검색 표시, 서버의 문서·이미지 읽기와 공개 문서 링크·다른 `.docatlas` 파일 404, 실행 중 저장한 개인 문서 반영) 통과.
test/browser/private.spec.js 2개(Private 그룹 배지·문서 머리 배지와 공개 문서에서 숨김, 검색 결과 배지) 통과.
npm run check 통과, npm test 189개 중 184개 통과·5개 건너뜀·실패 0, npm run test:browser 42개 통과(설치 Chromium 1243을 1248 이름으로 임시 연결),
npm pack --dry-run 49개 파일·64.8 kB. 스크린샷으로 지도·문서 머리·검색 결과의 표시를 확인했다.
종료 기준: 공개 문서 동작은 그대로이고 개인 문서가 Private 그룹으로만 보인다. 충족했다.

Files:
- `src/collector/policy.js` (modified)
- `src/collector/scan.js` (modified)
- `src/collector/search.js` (modified)
- `src/server/files.js` (modified)
- `src/web/app.js` (modified)
- `src/web/search.js` (modified)
- `src/web/reader.js` (modified)
- `src/web/index.html` (modified)
- `src/web/styles.css` (modified)
- `test/private-map.test.js` (added)
- `test/browser/private.spec.js` (added)
- `guide/document-map.md` (modified)
- `guide/configuration.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### 3단계 — 백업과 복구: 완료

진입: 1단계 완료. 2단계까지 완료(6b903f2, Platform checks run 41302543992가 macOS·Windows × Node 22·24에서 통과).
사용자가 컨텍스트를 비운 뒤 "이어서 해 줘"라고 해 2단계 리뷰 없이 3단계로 진행했다(2026-11-01). 2단계 리뷰는 요청하면 따로 한다.
기준 검증(6b903f2, Linux / Node 22.23.4): 2단계 종료 검증과 같은 커밋이다. npm run check 통과, npm test 189개 중 184개 통과·5개 건너뜀·실패 0.

- [x] 계약: DESIGN "백업과 복구(DC-34) — 3단계 구현"에 백업 폴더 이름·manifest·키 정규화·restore 순서·결과 줄·종료 코드를 먼저 적었다.
- [x] 프로젝트 키(key.js): origin 정규화(계정 정보·포트·.git 제거, 소문자, Windows 금지 문자·공백은 `-`, 예약 이름 앞 `_`,
  인코딩된 `/`·`..`도 폴더를 늘리거나 벗어나지 못함), origin 없으면 `local/<폴더 이름>`과 경고, `--key` 검사.
- [x] 백업 저장소(store.js): 임시 폴더에 파일과 manifest를 쓴 뒤 시각 이름으로 바꾸기, 같은 초는 `-2`, 0700/0600,
  링크를 따라가지 않는 읽기(O_NOFOLLOW), 저장소 경로의 링크 막기, 최신 일반 백업과 같으면 건너뜀, 빈 폴더는 백업 안 함.
- [x] 복구(restore.js·command.js): init과 같은 확인 → 백업 검증(경로·크기·해시) → create/unchanged/conflict/blocked 계획 →
  숨김 줄 먼저(숨겨지지 않으면 파일을 쓰지 않음) → `--force`면 복구 전 백업 → 쓰기(`wx`, 덮어쓰기는 임시 파일 뒤 이름 바꾸기).
  기본 복구 대상은 최신 일반 백업이고 복구 전 백업은 `--from`으로만 고른다. 백업에 없는 파일은 지우지 않는다.
- [x] list, status의 `backup <same|changed|none|unknown>` 줄, help(에이전트 순서: 고친 뒤 backup, 복구는 미리보기 → 사용자 확인 → 복구, --force는 사용자가 원할 때만).
- [x] 문서 지도 시작 안내(notice.js): 지도 루트가 git 최상위이고 개인 폴더에 파일이 없으며 일반 백업이 있을 때 한 줄. 읽기만 하고 실패하면 안내 없음.
  실행 폴더의 루트가 지도 루트와 다르면 명령에 `--root`를 붙인다.
- [x] 사용 가이드 document-map에 백업·복구 문단, CLI 도움말에 backup|list|restore 줄, test:platform에 새 테스트 파일.

기준 테스트: 임시 HOME과 두 clone(같은 origin, 다른 주소 형식)에서 백업 → 새 clone 복구, 충돌 보존, 심볼릭 링크 거부, 쓰기 범위 확인.
결과: test/private-backup.test.js 12개 통과(키 정규화, 작업 폴더를 지운 뒤 새 clone 미리보기·복구와 숨김, 같은 내용 건너뜀·빈 폴더·같은 초 이름·권한,
conflict 보존과 --force 전 백업·기본 대상·`--from` 되돌리기, 손상·잘못된 manifest·없는 백업에서 쓰기 없음, 링크 복사 안 함·링크 부모 blocked·링크 저장소 막기,
숨김 실패·추적 파일에서 멈춤, origin 없는 local 키와 `--key`, status 비교, 옵션 검사, 지도 안내 함수와 실제 지도 실행의 안내 줄).
npm run check 통과(문법 84개), npm test 201개 중 196개 통과·5개 건너뜀·실패 0, npm pack --dry-run 53개 파일·73.7 kB.
화면 변경이 없어 브라우저 테스트는 실행하지 않았다.
Windows 확인(Platform checks): 첫 실행(run 41303485971, 3024f63)은 Windows에서 멈췄다. 지도 안내 테스트가 Windows에서 지도를 끄지 않고
끝나 정리 단계가 실행 중인 폴더를 지우지 못했다(addfa4d로 테스트가 항상 지도를 끄게 고침). 다음 실행(run 41304255360)은
안내의 `--root` 경로를 JSON 방식으로 감싸 Windows 경로의 `\`를 두 번 쓰는 제품 문제를 찾았다(9134817로 필요할 때만, Windows는 큰따옴표,
macOS·Linux는 작은따옴표로 감싸게 고침). run 41304393601(9134817)이 macOS·Windows × Node 22·24에서 모두 통과했다.
종료 기준: 작업 폴더를 지운 뒤에도 새 clone에서 문서와 숨김 규칙이 돌아오고, 기존 파일은 말없이 덮어쓰이지 않는다. 충족했다.

Files:
- `src/private/key.js` (added)
- `src/private/store.js` (added)
- `src/private/restore.js` (added)
- `src/private/notice.js` (added)
- `src/private/command.js` (modified)
- `src/private/folder.js` (modified)
- `src/private/git.js` (modified)
- `src/private/index.js` (modified)
- `src/cli.js` (modified)
- `test/private-backup.test.js` (added)
- `package.json` (modified)
- `guide/document-map.md` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### 4단계 — 개인 문서 스킬·룰: 완료

Refs: RQ-22, DC-33, M-21, M-22, PR-10
진입: 1·3단계 완료(9134817, Platform checks run 41304393601 통과). 사용자가 4단계 진행을 요청했다(2026-11-01).
기준 검증(9134817, Linux / Node 22.23.4): npm run check(문법 84개·kit 1.2.0 세 쌍) 통과, npm test 201개 중 196개 통과·5개 건너뜀·실패 0.

- [x] 계약: DESIGN의 manifest 계약에 선택 key `requires`, 설치 명령의 `--all`(네 쌍), "개인 문서 스킬(DC-33) — 4단계 구현"의 구성,
  업데이트 안내(PR-10)의 항목 version 비교를 먼저 적었다.
- [x] agent-kit에 doc-driven-private-v1 스킬(3.7 kB)·룰(2.0 kB). designer를 따르고 범위·위치·쓰기 전(init, 빈 폴더면 list로 백업 확인 후 복구 여부 묻기,
  미리보기 → 동의 → 복구, `--force`는 요청 때만, 종료 3이면 멈춤)·작성 규칙(stage·commit·추적 파일 경로 금지, Refs·Files, 인계 위치,
  implementer·reviewer에게 경로 전달)·백업(고친 뒤, no-origin이면 `--key` 안내)·찾기(공개·개인 함께)만 담았다. designer 스킬(7.9 kB)의 절반 이하다.
- [x] manifest: kit 1.3.0, 항목 1.0.0, `default: false`, `requires: ["doc-driven-designer-v1"]`. 검사 스크립트가 requires를 확인하고(빈 목록·자기 자신·없는 이름·중복),
  loadKit이 넘기며, agents help 항목 줄이 `with --all or --only; needs doc-driven-designer-v1`을, 에이전트 순서 1번이 함께 고르기를 알린다.
  설치 동작은 바꾸지 않았다.
- [x] 업데이트 안내(PR-10): 새 항목만 더한 kit 1.3.0이 기존 세 항목 사용자에게 갱신 안내를 띄우지 않도록, 기록의 항목 version이 manifest 항목보다
  낮을 때만 안내한다(항목 version이 없으면 전처럼 kitVersion만 본다).
- [x] 문서: agent-kit/README(표·설치·새 항목 절차), README(저장소 구성·역할 표), METHOD 두 언어판(개인 문서 소절·요청 예시·도구 설명, 제목 20·목록 66으로 같은 구조),
  CHANGELOG Unreleased(개인 문서 명령·지도·kit 1.3.0).

기준 테스트: npm run check, npm test(kit 고정 테스트), agents help.
결과: npm run check(문법 84개·kit 1.3.0 네 쌍) 통과, npm test 203개 중 198개 통과·5개 건너뜀·실패 0(새 테스트: requires 검사, 새 항목만 더한 kit의 안내 없음),
npm pack --dry-run 55개 파일·76.6 kB. 임시 HOME에서 기본 설치 미리보기 12줄(세 쌍 × Claude·Codex), `--all` 16줄,
`--only doc-driven-private-v1` 설치와 Codex 변환(toml) 확인. Platform checks run 41304909846(be12eb2)이 macOS·Windows × Node 22·24에서 통과했다.
종료 기준: 스킬·룰만 읽고 개인 문서를 만들고 숨기고 백업하는 순서를 따를 수 있다. 문서상 충족했고, 실제 에이전트 세션 확인은 M-21·M-22 사람 확인으로 남긴다.

Files:
- `agent-kit/skills/doc-driven-private-v1/SKILL.md` (added)
- `agent-kit/agents/doc-driven-private-v1.md` (added)
- `agent-kit/manifest.json` (modified)
- `agent-kit/README.md` (modified)
- `scripts/agent-kit.js` (modified)
- `src/agent-kit/kit.js` (modified)
- `src/agent-kit/command.js` (modified)
- `src/agent-kit/notice.js` (modified)
- `test/agent-kit.test.js` (modified)
- `test/agent-kit-plan.test.js` (modified)
- `test/agent-kit-install.test.js` (modified)
- `test/agent-kit-notice.test.js` (modified)
- `README.md` (modified)
- `METHOD.md` (modified)
- `METHOD.ko.md` (modified)
- `CHANGELOG.md` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### Test Hardening: 완료

Refs: RQ-22, RQ-23, DC-34, DC-35, M-21, M-22
진입: 4단계 완료(be12eb2). 사용자가 다음 단계 진행을 요청했다(2026-11-01).
기준 검증(be12eb2, Linux / Node 22.23.4): 4단계 종료 검증과 같은 커밋이다. npm run check(kit 1.3.0 네 쌍) 통과, npm test 203개 중 198개 통과·5개 건너뜀·실패 0.

먼저 탐색 스크립트로 경계를 확인했다. 동시 init은 숨김 줄을 한 번만 쓰고, 8 MB 이진 파일·CRLF는 그대로 돌아오며, 같은 초의 동시 백업은
다른 이름의 온전한 백업이 됐다. 문제는 두 가지였다: 동시 복구에서 다른 실행이 막 만든 같은 내용의 파일을 conflict로 보고 종료 3을 냈고,
고친 뒤에도 다른 실행이 쓰는 중인 큰 파일을 읽어 conflict가 남았다.

- [x] 동시 실행 결정(설계 제안, DESIGN "백업과 복구"): 잠금 파일을 두지 않는다. 모든 쓰기가 원자적이거나 배타적이라 깨지거나 사라지는 파일이 없고,
  남는 영향은 같은 내용의 백업이 여러 개 생길 수 있다는 것뿐이다. 잠금은 중단된 실행의 잠금을 풀 규칙이 필요해 더 복잡하다.
- [x] 복구의 새 파일은 같은 폴더의 임시 파일에 쓴 뒤 hard link로 놓아 다 쓴 파일만 보인다(hard link가 없으면 `wx`).
  이미 있는 이름이면 내용을 비교해 같으면 unchanged, 다르면 conflict로 본다.
- [x] 검사와 쓰기 사이 재확인: restore는 숨김 줄 뒤 파일을 쓰기 전에, backup은 파일을 읽은 뒤 개인 폴더를 다시 확인한다(링크면 종료 3).
- [x] 경계 테스트: test/private-hardening.test.js 6개. 한글·공백 기능·파일 이름, CRLF, 마지막 줄바꿈 없음, 빈 파일, 6 MB 이진 이미지의 바이트 단위 왕복,
  동시 init 5개·backup 3개·restore 2개(온전한 백업, 남은 임시 파일 없음, 각 파일을 한 번만 만들고 다른 실행은 unchanged),
  쓰기 중 실패한 백업의 임시 폴더 정리, 링크로 바뀐 개인 폴더에서 backup·restore·restore --force·status가 쓰기 전에 멈춤,
  계획 뒤 링크로 바뀐 폴더에 쓰지 않음, 권한(읽을 수 없는 파일·쓸 수 없는 저장소·쓸 수 없는 복구 폴더는 종료 1, 남은 임시 파일 없음, 고친 뒤 다시 실행하면 완료).
- [x] Windows: test/private.test.js(1단계), test/private-backup.test.js(3단계), test/private-hardening.test.js를 test:platform에 넣었다.
- [x] 알려진 한계(DESIGN): 같은 사용자가 검사와 쓰기 사이의 짧은 틈에 경로를 바꾸는 경우까지는 막지 않는다(Node에 openat 계열 없음).
  강제 종료된 백업이 남긴 `.partial-…` 폴더는 백업으로 보지 않고 지우지도 않는다(백업 정리 기능과 함께 후속).

결과: npm run check 통과, npm test 209개 중 203개 통과·6개 건너뜀(root 실행으로 권한 테스트 1개 추가 건너뜀)·실패 0.
root가 아닌 사용자(nobody)로 사본에서 개인 문서 테스트 3개 파일 42개를 돌려 권한 테스트까지 모두 통과했다.
Platform checks run 41305526082(c744624)가 macOS·Windows × Node 22·24에서 통과했다(Windows에서도 hard link로 복구).
종료 기준: 동시 실행·실패·권한·링크에서 파일이 깨지거나 사라지지 않고, 잘못된 conflict를 내지 않는다. 충족했다.

Files:
- `src/private/restore.js` (modified)
- `src/private/command.js` (modified)
- `test/private-hardening.test.js` (added)
- `package.json` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### 백업 개수 제한 — 완료

Refs: RQ-23, DC-34, M-22
진입: 2026-11-01 사용자 변경. 백업을 다시 하면 덮어쓰는지 묻고, 모두 보관한다는 설명을 들은 뒤 "최근 n개만 남기기, 기본 3개"를 골랐다.
기준 검증(c744624, Linux / Node 22.23.4): Test Hardening 종료 검증과 같은 커밋이다. npm run check 통과, npm test 209개 중 203개 통과·6개 건너뜀·실패 0.

- [x] 문서: REQUIREMENTS에 사용자 변경, DESIGN "보관 개수"와 결과 줄(`remove backup`, `removed=`), DC-34 결정 줄을 먼저 고쳤다.
- [x] backup이 create·unchanged로 끝나면 그 키의 백업을 이름(UTC 시각) 순으로 최신 3개만 남긴다. `--keep <n>`(1~1000)은 그 실행에만 적용된다.
  종류(backup·before-restore)를 가리지 않고 세며, 방금 만든 백업과 unchanged일 때의 최신 일반 백업은 지우지 않는다.
  파일이 없어 skip한 실행, restore·list·status는 지우지 않는다. manifest를 읽을 수 있는 실제 폴더만 지우고 잘못된 백업·`.partial-…`은 둔다.
- [x] help·사용 가이드·CHANGELOG Unreleased·M-22 항목. 개인 문서 스킬 문장("바뀐 것이 없으면 복사하지 않는다")은 그대로 맞아 스킬 버전은 올리지 않았다.

기준 테스트: npm test(개인 문서 백업 테스트).
결과: 새 테스트 1개(네 번째 백업에서 가장 오래된 것 삭제, `--keep 5`·`--keep 1`, 잘못된 백업·`.partial` 보존, 시계가 뒤로 간 새 백업 보존,
빈 폴더 skip·restore·list·status는 지우지 않음)와 `--keep` 옵션 검사(0·1001·all·2.5, 다른 명령) 통과.
npm run check 통과, npm test 210개 중 204개 통과·6개 건너뜀·실패 0. Platform checks run 41306271470(6571597) 통과.
종료 기준: 기본 실행은 최신 3개만 남기고, 복구할 백업을 지우는 경우가 없다. 충족했다. 기본 개수는 아래에서 10개로 바꿨다.

Files:
- `src/private/store.js` (modified)
- `src/private/command.js` (modified)
- `src/private/index.js` (modified)
- `test/private-backup.test.js` (modified)
- `guide/document-map.md` (modified)
- `CHANGELOG.md` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### 기본 10개와 origin 없는 키 보강 — 완료

Refs: RQ-23, DC-34, M-22
진입: 2026-11-01 사용자 질문과 선택. GitLab에서도 키가 되는지, git이 아니면 폴더 이름인지 묻고, 기본 개수를 다시 추천해 달라고 했다.
에이전트가 기본 10개와 origin 없는 키의 경로 구분값을 추천했고 사용자가 "추천대로" 정했다.
기준 검증(6571597, Linux / Node 22.23.4): 직전 단계 종료 검증과 같은 커밋이다. npm test 210개 중 204개 통과·6개 건너뜀·실패 0.

- [x] 확인: 키는 호스트를 가리지 않는다. GitLab(하위 그룹 포함)·사내 호스트(포트 제거)·Bitbucket 주소가 `호스트/경로` 키가 된다. 원격 이름은 origin이어야 한다.
- [x] 문서: REQUIREMENTS에 질문·추천·선택, DESIGN 키 규칙과 보관 개수, DC-34 결정 줄을 먼저 고쳤다.
- [x] 기본 보관 개수 10(`DEFAULT_KEEP`). help는 이 값을 그대로 보여 준다.
- [x] origin이 없거나 git 밖이면 `local/<폴더 이름>-<경로 SHA-256 앞 8자>`(Windows·macOS는 경로 소문자). 다른 위치의 같은 이름 폴더가 백업을 섞거나
  서로 지우지 않는다. 폴더를 옮기면 `--key`로 이전 키를 쓴다고 no-origin 경고와 help에 적었다. 출력된 키는 그대로 `--key`에 쓸 수 있다.
- [x] 사용 가이드·CHANGELOG Unreleased(10개, 모든 호스트, origin 없는 키)·M-22 항목. 개인 문서 스킬 문장은 그대로 맞아 스킬은 바꾸지 않았다.

기준 테스트: npm test(개인 문서 백업 테스트).
결과: 보관 테스트를 10개 기준으로 바꿨다(11번째 백업에서 가장 오래된 것 삭제, `--keep 3`·`--keep 1`). origin 없는 키 테스트에 형식·`--key` 재사용,
다른 위치의 같은 이름 폴더 두 개가 다른 키, Windows 경로 대소문자 무시·Linux 구분을 더했다.
npm run check 통과, npm test 210개 중 204개 통과·6개 건너뜀·실패 0.
Platform checks run 41306747792(205385d)가 macOS·Windows × Node 22·24에서 통과했다.
종료 기준: 기본 실행은 최신 10개를 남기고, origin 없는 같은 이름 폴더의 백업이 섞이지 않는다. 충족했다.

Files:
- `src/private/store.js` (modified)
- `src/private/key.js` (modified)
- `src/private/command.js` (modified)
- `src/private/index.js` (modified)
- `test/private-backup.test.js` (modified)
- `guide/document-map.md` (modified)
- `CHANGELOG.md` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### 백업 시점과 파일 공유 — 완료

Refs: RQ-23, DC-33, DC-34, M-22
진입: 2026-11-01 사용자 변경. 백업이 커질지, zip으로 옮겨도 되는지, phase마다 저장되는지 묻고 수동 백업만 두는 안을 비교한 뒤,
"자동 백업은 구현 phase에서 에이전트 몫을 마쳤을 때 한 번, 나머지는 명시적 요청 때만, 하드 링크는 넣고 10개 유지"로 정했다.
Integration Test 뒤의 변경이라 문서 순서상 그 앞에 둔다.
기준 검증(6b2a1d4, Linux / Node 22.23.4): npm run check 통과, npm test 210개 중 204개 통과·6개 건너뜀·실패 0, npm run test:integration 6개 통과.

- [x] 문서: REQUIREMENTS에 사용자 변경과 배경, DESIGN의 백업 시점·파일 공유·스킬 구성·implementer 한 줄을 먼저 고쳤다.
- [x] 백업 파일 공유(store.js): 같은 키의 기존 백업에 해시가 같은 파일이 있으면 읽어서 크기·해시를 확인한 뒤 하드 링크를 건다.
  링크를 못 하거나 확인에 실패하면 복사한다. 보관 개수 10과 지우기 규칙은 그대로다.
- [x] doc-driven-private-v1(배포 전 1.0.0, 버전 그대로 해시만 갱신): 구현 phase에서 구현·자동 테스트를 마치고 수동 확인만 남았을 때 한 번,
  그 밖에는 요청할 때만 백업한다. 문서를 쓰거나 고친 것만으로는 백업하지 않는다.
- [x] doc-driven-implementer-v1 1.3.0(스킬·룰): phase 문서가 `.docatlas/private/` 아래면 phase 끝에 문서를 맞춘 뒤 한 번 백업한다.
  1.2.0의 스킬·룰·Codex 변환 해시를 previous로 옮겼다(kit 1.2.0, docatlas 0.4.2). kit은 배포 전 1.3.0 그대로다.
- [x] CHANGELOG Unreleased(공유·zip, phase 끝 백업, implementer 1.3.0이라 지도가 갱신을 안내함), 사용 가이드, agent-kit/README 표, M-22 항목.

기준 테스트: npm test(백업 테스트), npm run test:integration.
결과: 새 테스트 1개(바뀌지 않은 이미지는 링크 수 2로 공유, 바뀐 문서는 새 사본, `--keep 1`로 앞 백업을 지워도 공유 데이터 유지,
손상된 저장 파일은 공유하지 않고 새로 복사, 복구 바이트 일치). npm run check(kit 1.3.0 네 쌍) 통과, npm test 211개 중 205개 통과·6개 건너뜀·실패 0,
npm run test:integration 6개 통과. 수동 확인: 2 MB 이미지가 든 백업 5개는 공유로 2.1 MB였고, zip으로 묶어 다른 홈에 풀면 10 MB(공유가 풀림)가 되며
그 백업으로 새 clone 복구가 바이트 단위로 일치했다. Platform checks run 41309468776(27c02c8)이 macOS·Windows × Node 22·24에서 통과했다
(Windows에서도 하드 링크 공유, 링크 수 확인 포함).
종료 기준: 에이전트의 자동 백업은 구현 phase마다 한 번뿐이고, 10개를 남겨도 바뀌지 않은 파일은 한 벌만 차지한다. 충족했다.

Files:
- `src/private/store.js` (modified)
- `test/private-backup.test.js` (modified)
- `agent-kit/skills/doc-driven-private-v1/SKILL.md` (modified)
- `agent-kit/agents/doc-driven-private-v1.md` (modified)
- `agent-kit/skills/doc-driven-implementer-v1/SKILL.md` (modified)
- `agent-kit/agents/doc-driven-implementer-v1.md` (modified)
- `agent-kit/manifest.json` (modified)
- `agent-kit/README.md` (modified)
- `guide/document-map.md` (modified)
- `CHANGELOG.md` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### 2단계~파일 공유 리뷰 반영 — 완료

Refs: RQ-22, RQ-23, DC-33, DC-34, DC-35, DC-36, M-21, M-22
진입: 사용자 요청으로 doc-driven-reviewer-v1(별도 에이전트, 읽기 전용)이 58c71f5..5e015e0(2단계~백업 시점과 파일 공유, 커밋 11개)을 리뷰했다.
결과 REQUEST_CHANGES: critical 2·warning 4·suggestion 3. 리뷰어가 npm run check, npm test(211개 중 205개 통과·6개 건너뜀), test:integration 6개를 다시 돌렸고,
implementer 1.2.0의 previous 해시가 58c71f5와 맞음을 확인했다. 9개 Files 블록은 커밋과 맞았다.
기준 검증(5e015e0): npm run check 통과, npm test 211개 중 205개 통과·6개 건너뜀·실패 0.

- [x] critical: `docatlas private help`의 에이전트 순서 2번이 아직 "고친 뒤 백업"이었다. "구현 phase마다 한 번(수동 확인만 남았을 때), 그 밖에는 요청 때만,
  문서가 바뀌었다는 이유로 백업하지 않음"으로 고치고 help 테스트에 넣었다.
- [x] critical: 이름에 `\`가 있는 개인 파일(macOS·Linux에서 가능)이 있으면 백업이 성공으로 보고되지만 manifest가 거부돼 그 백업 전체를 복구할 수 없고,
  unchanged가 맞지 않아 백업이 계속 쌓였다. 사용자가 "경고 후 건너뛰기"를 골랐다: `warning unsupported-name <경로>`로 알리고 빼며 나머지를 백업한 뒤 종료 3.
  writeBackup은 manifest를 list·restore와 같은 검사로 확인한 뒤에만 저장한다. 회귀 테스트 2개(Windows는 그런 이름을 만들 수 없어 첫 테스트는 건너뜀).
- [x] warning: DESIGN DC-34 결정 줄에 백업 시점 변경과 하드 링크 공유를 적었다. 인계의 커밋 목록을 명시했다(아래).
  test/private-map.test.js를 test:platform에 넣었다(2단계 수집기·서버 로직이 macOS·Windows에서 돈 적이 없었다). M-21 문구를 바로잡았다.
  guide/configuration.md에서 기존 문단 가운데 끼어 있던 개인 폴더 문단을 문단 뒤로 옮겼다.
- [x] suggestion: DESIGN 동시 실행 설명에 정리가 겹칠 때 다른 실행의 새 백업이 지워질 수 있음을 적었다(최신은 항상 남음). backup 경고 경로를 루트 기준으로,
  restore `--force`의 경고 줄을 DESIGN·help에 적었다. implementer 스킬·룰 문장을 "phase 문서를 갱신했다면"으로 바꿔(줄 수 그대로) 문서를 맡지 않은
  서브에이전트가 백업하지 않게 했다. implementer 1.3.0은 배포 전이라 버전 그대로 해시만 갱신했다.

결과: npm run check 통과, npm test 213개 중 207개 통과·6개 건너뜀·실패 0, npm run test:platform 58개 중 55개 통과·3개 건너뜀(root),
npm run test:integration 6개 통과. Platform checks run 41324166410(2ab6639)이 macOS·Windows × Node 22·24에서 통과했다
(test/private-map.test.js 처음 포함).
종료 기준: critical을 모두 고치고 warning·suggestion을 반영한다. 충족했다.

Files:
- `src/private/command.js` (modified)
- `src/private/store.js` (modified)
- `test/private-backup.test.js` (modified)
- `agent-kit/skills/doc-driven-implementer-v1/SKILL.md` (modified)
- `agent-kit/agents/doc-driven-implementer-v1.md` (modified)
- `agent-kit/manifest.json` (modified)
- `package.json` (modified)
- `guide/configuration.md` (modified)
- `CHANGELOG.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### Integration Test: 자동 검증 완료

Refs: RQ-22, RQ-23, DC-32, DC-33, DC-34, DC-35, DC-36, M-21, M-22
진입: 4단계·Test Hardening·보관 개수 변경 완료(205385d, Platform checks run 41306747792 통과). 사용자가 다음 단계 진행을 요청했다(2026-11-01).
기준 검증(205385d, Linux / Node 22.23.4): npm run check 통과, npm test 210개 중 204개 통과·6개 건너뜀·실패 0.
기준 통합 테스트(205385d): npm run test:integration 5개 중 4개 통과, F-09 실패. 4단계에서 통합 테스트를 돌리지 않아 놓친 회귀다.

- [x] F-09 수정(4단계 회귀): `--all` 프로젝트 설치가 private까지 16개를 만들고 private에는 같은 이름 경고가 없음을 확인하게 했다.
  업데이트 안내 확인은 기록의 kitVersion만 낮추던 것을 항목 version도 낮추게 했다(4단계 PR-10 보완의 의도대로 새 항목만 더한 kit은 안내하지 않음).
  홈 폴더 비교에서 npm이 스스로 쓰는 `~/.npm` 로그를 뺐다. 실행마다 생기기도 하고 안 생기기도 해 docatlas와 무관하게 실패했다.
- [x] F-10(test/integration/private.test.js): production tarball을 별도 폴더에 설치하고 그 실행 파일로 진행한다. 임시 HOME·git 설정을 쓴다.
  origin(bare)에 공개 docs·커밋한 `.docatlas/agents.json`·하위 폴더 `.docatlas`를 올리고, 첫 clone(origin을 GitLab https로)에서
  docs 하위 폴더로 init → 두 기능의 개인 문서(CRLF·이미지·한글 이름, 공개 문서 링크)와 링크 → git status 깨끗함 → status ok →
  backup(키 `gitlab.com/team/web/shop`, 링크 경고) → 같은 내용 다시 백업은 unchanged → 지도의 Private 그룹(하위 `.docatlas` 제외, 안내 없음) →
  작업 폴더 삭제 → 둘째 clone(origin을 GitLab ssh로) → 지도 시작 안내 → 미리보기(쓰기 없음) → 복구(4개 생성, 바이트 일치, exclude 줄, git status 깨끗함,
  status의 backup same) → 지도의 Private 그룹과 개인 → 공개 링크, 안내 없음.

결과: npm run test:integration 6개 통과(두 번 연속), npm run test:browser 42개 통과(설치 Chromium 1243을 1248 이름으로 임시 연결),
npm run check 통과, npm test 210개 중 204개 통과·6개 건너뜀·실패 0, npm pack --dry-run 55개 파일·77.8 kB.
종료 기준: M-21·M-22의 자동 근거가 갖춰지고 사람 확인 항목이 정리된다. 자동 근거는 충족했다. 남은 사람 확인은 M-21·M-22의 미체크 항목이다
(실제 에이전트 세션에서 스킬대로 동작하는지, Windows 콘솔·실제 GitLab 원격, 설치 미리보기의 사람 확인).

Files:
- `test/integration/private.test.js` (added)
- `test/integration/agent-kit.test.js` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

## 0.5.0 배포 준비 — 완료, 게시 확인

Refs: RQ-21, RQ-22, RQ-23, DC-31, DC-33, M-20, M-21, M-22
진입: 개인 문서와 백업의 모든 단계와 리뷰 반영을 작업 브랜치에 커밋했다(1814833, Platform checks run 41324166410 통과).
사용자가 기존 사용성 영향이 없는지 확인한 뒤 0.5.0 배포를 요청했다(2026-11-01).
기준 검증(1814833, Linux / Node 22.23.4): npm run check 통과, npm test 213개 중 207개 통과·6개 건너뜀·실패 0.

- [x] manifest·lockfile을 npm version 0.5.0 --no-git-tag-version --ignore-scripts로 갱신했다. CLI --version이 0.5.0을 출력한다.
- [x] CHANGELOG의 Unreleased를 0.5.0 — 2026-11-01로 옮겼다. 날짜는 npm 게시일(UTC)이며 다른 날 게시하면 고친다.
- [x] npm run check(문법 86개·kit 1.3.0 네 쌍), npm test 213개 중 207개 통과·6개 건너뜀(root)·실패 0, npm run test:platform 58개 중 55개 통과·3개 건너뜀,
  npm run test:integration 6개(F-07·F-09·F-10), npm run test:browser 42개(설치 Chromium 1243을 1248 이름으로 임시 연결) 통과.
  npm pack·publish --dry-run: docatlas@0.5.0, 55개 파일, 79.2 kB(풀면 272.4 kB), latest·public. 레지스트리의 latest는 아직 0.4.2다.
- [x] agents help가 Kit 1.3.0과 designer 1.3.0·implementer 1.3.0·reviewer 1.5.0 default, private 1.0.0 `with --all or --only; needs doc-driven-designer-v1`을 출력한다.
- [x] 사용자 요청으로 작업 브랜치를 main에 fast-forward로 반영해 푸시했다(75c7e62, PR 없음). 작업 브랜치는 지우지 않았다.
  main CI(Platform checks run 41325036270, push)가 macOS·Windows × Node 22·24 네 작업 모두 통과했다.
  이 기록은 작업 브랜치에만 있고 main에는 게시 기록과 함께 반영한다.

- [x] 게시 확인(2026-11-01): 사용자가 `v0.5.0` 태그(75c7e62)를 푸시했고 Publish to npm(run 41325911232, 16:21 UTC)이 성공했다.
  npm latest 0.5.0, gitHead 75c7e62, SLSA provenance 있음. 영문 GitHub 릴리스 노트를 0.4.2와 같은 구성으로 준비해 미리 채운 작성 링크로 건넸다
  (이 세션의 GitHub 도구에는 릴리스 생성이 없다). 사용자가 GitHub 릴리스 v0.5.0을 만들었다(16:28 UTC, 노트 그대로).
- [x] 사용자 확인 뒤 게시·릴리스 기록 커밋을 main에 fast-forward로 반영했다.
종료 기준: 0.5.0 후보의 파일 구성과 버전 표시가 맞고 검사가 통과하며 main에 반영된다. 충족했고 게시도 확인했다.

Files:
- `package.json` (modified)
- `package-lock.json` (modified)
- `CHANGELOG.md` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)

### 0.5.0 게시 절차 — 태그 푸시(RQ-21)

이 세션의 git 연결은 태그 푸시를 거절하므로 사용자가 태그를 푸시한다. main CI가 통과한 뒤 main의 최신 커밋에 건다.

```sh
git checkout main
git pull --ff-only origin main
git tag v0.5.0
git push origin v0.5.0
npm view docatlas version --registry=https://registry.npmjs.org/
npx --yes docatlas@0.5.0 private help
```

Publish to npm workflow가 태그 커밋이 main에 있는지, 태그가 package.json 버전과 같은지 확인한 뒤 검사·테스트를 거쳐 게시한다.
2026-11-02(UTC) 이후에 게시하면 CHANGELOG의 날짜를 고친다.

## 클라우드 백업과 새 컴퓨터 복구 — 구현·자동 검증 완료(0.6.0 게시)

Refs: RQ-24, RQ-25, RQ-26, RQ-27, RQ-28, RQ-29, DC-34, DC-37, DC-38, DC-39, DC-40, DC-41, DC-42, DC-43, DC-44, M-22, M-23, M-24, M-25, M-26, M-27, M-28, M-29

### 방식 검토 — 완료(2026-11-03)

Refs: RQ-24, RQ-25, RQ-26, DC-37, DC-38, DC-39, DC-40, DC-41, DC-42, M-23, M-24, M-25, M-26

진입: private·백업 기능이 구현된 0.5.0과 사용자의 클라우드 연동 검토 요청. 시작 변경 목록: 없음. 기준 커밋 23f6de8.
기준 검증: 기준 4종·private 저장/복구/키·개인 문서 스킬의 실제 계약, 공식 전송·인증 문서를 확인한다.

- [x] 용도 확인: 사용자는 클라우드 백업 후 새 컴퓨터에서 필요할 때 복구하기를 선택했다.
- [x] 동기화 폴더·rclone·직접 API·개인 비공개 Git의 부담과 적용 가능성을 비교했다.
- [x] 기존 백업 저장소를 유지하고 별도 사본을 전송하는 안, 미완성 사본·기기 간 이름 충돌·재시도·보관·암호화의 미정 사항을 기록했다.
- [x] REQUIREMENTS의 확인된 용도/정책, DESIGN의 DC-37~42, M-23~26의 미실행 인수 후보를 맞췄다.
- [x] 후속 질문의 공간 절약 선호를 기록하고 여러 백업 tar 묶음·해시별 공유 저장을 비교했다.
  현재 백업 코드와 설치된 tar의 합성 10개 백업 실험에서 묶음 내 데이터 공유와 풀기 후 하드 링크 복원을 확인했다(DESIGN 결과).
- [x] npx의 설치 후 크기와 압축 전송·캐시 재사용을 구분하고, tar 의존성을 추가하는 CLI 안과 시스템 tar를 사용하는 선택 스킬 안을 비교했다.
  스킬·룰 텍스트는 기존 설치기로 배포 가능하지만 보조 스크립트 동반 설치는 현재 계약에 없음을 확인했다. 전용 스킬/룰 중심으로 방향을 확인했고 원본 작성은 미착수다.
- [x] RQ-25의 OS/설치 환경 안내와 기존 상태 우려를 기록했다. 현재 status/list로 알 수 있는 로컬 상태와,
  연결 기록·실제 사본 대조·실행 잠금·원격 상태 확인의 추가 설계 범위를 DC-41/M-24에 나눴다.
- [x] 새 컴퓨터에서는 코드만으로 백업 위치를 알 수 없다는 최초 연결의 한계를 명시했다.
  사용자에게 위치 단서만 받고 작은 복구 목록으로 나머지 방식·프로젝트·시점을 확인하는 안내를 DC-38·41/M-24 후보로 보완했다.
- [x] 사용자가 클라우드는 명시적 요청에만 실행하고 권유하지 않는 것으로 정했다(RQ-26/DC-42). phase 끝 자동 연결이라는 초기 제안을 관련 문서에서 대체했다.
- [x] Google Drive/Dropbox의 Windows/macOS 지원을 공식 문서로 확인하고, 집/회사 PC 교대의 명시적 백업·복구/충돌 보호를 M-26 후보로 정리했다. 서비스 선택은 미정이다.

종료 기준: 비교·추천과 미정 사항이 기준 4종에 남고, 구현된 동작으로 오해할 명령 안내가 없다. 문서 확인 결과는 현재 인계를 따른다.

Files:
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### 선택 백업 역할과 보조 명령 — 완료(2026-11-03)

Refs: RQ-24, RQ-25, RQ-26, RQ-27, RQ-28, RQ-29, DC-37, DC-38, DC-39, DC-40, DC-41, DC-42, DC-43, DC-44, M-23, M-24, M-25, M-26, M-27, M-28, M-29

진입: 사용자가 구현과 전체 단계 진행을 승인했다. 새 선택 쌍 doc-driven-backup-v1, 외부 의존성 없는 private-cloud 보조 명령과 제한 USTAR 계약을 기준 4종에 먼저 기록했다.
시작 변경은 이 대화에서 만든 기준 4종뿐이다. 기준 커밋 23f6de8. 기준 검증은 문법 86개·기존 테스트 213/213 통과다.
첫 서버 테스트는 샌드박스 loopback 제한에 막혀 종료했고 승인된 환경에서 전체 재실행했다.

- [x] 새 스킬/룰 1.0.0과 Codex 명시적 호출 정책을 kit 1.4.0에 선택 항목으로 등록했다. 기존 네 쌍의 본문/버전/해시와 기본 세 쌍을 유지했다.
- [x] 사용자 지정 동기화 폴더에 tar/복구 목록을 준비하고, 검증한 내용만 기존 로컬 저장소로 가져와 미리보기/복구한다. 로컬 하드 링크 공유를 재구성한다.
- [x] 이름별 연결/상태와 태그/불변 ID 선택을 제공한다. 기기별 UUID와 부모 관계로 분기를 구분하며 기존 태그를 덮어쓰지 않는다.
- [x] 사용자 확인에 따라 경로 범위를 `.docatlas/private/`로 확정했다. 백업/복구 모두 반복 --path와 생략 시 전체를 지원하고 다른 로컬 파일을 보존한다.
- [x] connections/status/projects/list로 기존 연결·현재 파일·실제 사본을 확인한다. 연결/정상 기록과 원격 unknown을 구분하고 로컬 잠금은 ID/프로세스로 보호한다.
- [x] OS/클라우드 앱/최초 위치 단서 안내를 스킬에 기록했다. 기존 스킬·phase·서버에는 클라우드 호출/알림을 추가하지 않았다.

종료 기준 충족: 합성 두 HOME의 백업/새 PC 복구와 선택 경로 보존이 동작한다. 문법·기능·기존 스킬 보존 검증을 통과했다.
이 구현 단계에는 게시·실제 계정 연결·사용자 환경 설치를 포함하지 않았다. 이후 사용자 배포 요청은 아래 0.6.0 배포 단계에서 진행한다.

Files:
- `CHANGELOG.md` (modified)
- `METHOD.ko.md` (modified)
- `METHOD.md` (modified)
- `README.md` (modified)
- `agent-kit/README.md` (modified)
- `agent-kit/manifest.json` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `package.json` (modified)
- `scripts/agent-kit.js` (modified)
- `src/agent-kit/command.js` (modified)
- `src/agent-kit/kit.js` (modified)
- `src/agent-kit/plan.js` (modified)
- `src/cli.js` (modified)
- `agent-kit/agents/doc-driven-backup-v1.md` (added)
- `agent-kit/skills/doc-driven-backup-v1/SKILL.md` (added)
- `agent-kit/skills/doc-driven-backup-v1/agents/openai.yaml` (added)
- `guide/cloud-backups.md` (added)
- `src/private-cloud/archive.js` (added)
- `src/private-cloud/command.js` (added)
- `src/private-cloud/repository.js` (added)
- `src/private-cloud/state.js` (added)

### Test Hardening — 자동 검증 완료(2026-11-03)

Refs: RQ-24, RQ-25, RQ-26, RQ-27, RQ-28, RQ-29, DC-37, DC-38, DC-39, DC-40, DC-41, DC-42, DC-43, DC-44, M-23, M-24, M-25, M-26, M-27, M-28, M-29

진입: 기본 왕복/읽기 전용 미리보기와 상태/잠금 구현. 기준 검증은 구현 중 기능/설치 테스트 33개 통과다.

- [x] 합성 두 HOME/프로젝트/동기화 폴더로 전체/다중/단일 선택과 추가 복구, 이름/태그/중복 태그/정확한 ID 선택을 검증했다. 선택 일부만 존재할 때도 누락을 보고하고 준비/복구를 중단한다.
- [x] 내용 중복 제거와 로컬 하드 링크 재구성, 미완료 전송·해시 변조·잘못된 tar 체크섬/종류/경로/확장/잘림을 검증했다.
- [x] tar 부재·오프라인 경로·기호 링크·손상된 설정/상태·실행 중/중단된 잠금과 잠금 경로 교체에서 기존 자료 보존을 검증했다.
- [x] 서로 반대인 기기 시계·부모 관계·분기·동일 내용 재실행을 검증했다. 시각만으로 최신을 선택하지 않는다.
- [x] 기존 네 쌍의 공개 해시와 설치된 바이트 보존, 새 정책의 해시/경로/불리언 검증과 반복 설치를 확인했다.
- [x] 시스템 tar/Node 기본 기능만 사용한다. 첫 형식은 평문이라 암호화 키/API 인증 테스트는 적용하지 않는다.
- [x] 새 스킬 quick_validate 통과. 별도 에이전트가 스킬을 읽고 합성 환경에서 a만 personal/v1로 백업 → 새 PC 미리보기 → 호출자 승인 후 복구했다. a,c만 남고 c 바이트·git 숨김·이름별 상태가 보존됐다.

종료 기준 충족: `npm run check`(문법 92개·kit 다섯 쌍), `npm test` 231/231 통과. 잘못된 사본으로 현재 문서를 바꾸거나 원격 완료로 보고하지 않는다.
스킬의 일반 작업 무권유·실제 OS 안내는 텍스트 정책/호출 경계와 합성 요청 흐름을 확인했으며 장기 실제 에이전트 세션 인수는 M-25에 남긴다.

Files:
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `package.json` (modified)
- `src/private-cloud/command.js` (added)
- `test/agent-kit-plan.test.js` (modified)
- `test/agent-kit.test.js` (modified)
- `test/private-cloud.test.js` (added)

### Integration Test — 자동 검증 완료·실제 서비스 인수 대기(2026-11-03)

Refs: RQ-24, RQ-25, RQ-26, RQ-27, RQ-28, RQ-29, DC-37, DC-38, DC-39, DC-40, DC-41, DC-42, DC-43, DC-44, M-23, M-24, M-25, M-26, M-27, M-28, M-29

진입: Test Hardening 통과. 기준은 기존 F-07·09·10과 Node 전체 테스트 결과다.

- [x] F-11: production tarball을 offline 설치한 뒤 선택 쌍/Codex 정책 설치, 이름 personal/태그 v1/a 선택 백업, 새 HOME의 후보 발견·미리보기·복구를 실행했다. 기존 c와 git 숨김을 보존하고 b는 가져오지 않았다.
- [x] F-09의 --all 계약을 다섯 쌍+Codex 정책 21파일로 맞췄다. 기본 설치는 12파일이다.
- [x] `DOCMAP_BROWSER_CHANNEL=chrome npm run test:integration` 7/7 통과(F-07·09·10·11). 기본 실행은 캐시된 Chromium 부재로 F-07만 실패했으며 설치된 Chrome으로 전체를 재실행했다.
- [x] macOS arm64 / Node 24.22.1 / Chrome 156.0.8078.80에서 확인했다. test:platform에 cloud 기능 테스트를 등록했다. UI 소스 변경은 없다.
- [x] 기준 4종·README·METHOD 두 언어판·kit README·새 가이드의 로컬 링크/앵커 67개(9문서), git diff --check 통과.
- [x] `npm pack --dry-run --json --ignore-scripts`: 62파일, 압축 97,722바이트·해제 338,415바이트. 기준 79,226/272,358 대비 각각 +18,496/+66,057바이트이며 런타임 의존성 변화는 없다.
- [x] 후속 배포 단계에서 Windows/macOS × Node 22/24 CI를 통과했다(run 41591966422).
- [ ] 실제 클라우드 앱의 업로드/다운로드와 Windows 콘솔, 일반 작업/새 세션의 실제 에이전트 인수(M-23~26). 이번 합성 결과로 대체하지 않는다.

종료 기준: 패키지 설치/두 HOME 왕복의 자동 범위는 충족했다. 실제 서비스/다른 OS 결과는 미실행으로 기록해 별도 인수로 남긴다. 기존 지도 회귀는 F-07·10으로 확인했다.

Files:
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `test/integration/agent-kit.test.js` (modified)
- `test/integration/private-cloud.test.js` (added)

## 0.6.0 배포 — 완료(2026-11-03)

Refs: RQ-21, RQ-24, RQ-25, RQ-26, RQ-27, RQ-28, RQ-29, DC-31, DC-37, DC-38, DC-39, DC-40, DC-41, DC-42, DC-43, DC-44, M-20, M-23, M-24, M-25, M-26, M-27, M-28, M-29

진입: 사용자가 커밋·푸시·배포를 명시적으로 요청했다(2026-11-03). 시작은 위 구현 단계의 미커밋 변경 29파일이며 origin/main과 HEAD는 23f6de8로 일치했다.
기준 검증: check 92 JS/다섯 쌍, Node 231개·통합 7개, skill 검증·독립 합성 에이전트 왕복 통과. npm latest는 0.5.0이고 0.6.0은 미게시다.
새 기능을 담는 마이너 버전 0.6.0으로 진행한다. 게시·GitHub 릴리스 생성 권한은 이번 사용자 요청에 포함된다.

- [x] package.json/lockfile을 0.6.0으로 올리고 CHANGELOG/가이드를 맞췄다.
- [x] Test Hardening: 버전 변경 뒤 check 92 JS/다섯 쌍, Node 231/231, npm publish --dry-run 통과. 62파일, 압축 97,723바이트·해제 338,415바이트, latest/public 설정이다.
- [x] Integration Test(로컬): 0.6.0 production tarball 설치/백업·복구 통합 7/7 통과.
- [x] main의 macOS/Windows × Node 22/24 Platform checks 통과(run 41591966422, 26e30de).
  첫 run 41591482958(a2ab079): macOS 두 조합 통과, Windows 두 조합에서 한글 홈 아래 긴 절대 출력 경로를 시스템 tar가 열지 못해 새 cloud 테스트 10개 실패.
  tar 출력 인자를 staging 기준 상대 경로로 바꾼다. 기존 한글 HOME 합성 테스트가 회귀 검증이며, 로컬/CI 재검증 후 태그를 푸시한다.
- [x] a2ab079(기능/버전)와 26e30de(Windows tar 경로 수정)를 main에 커밋·푸시했다. 네 CI 조합 통과 후 26e30de에 v0.6.0을 푸시했다. Publish to npm run 41592640829 성공, npm latest 0.6.0·gitHead 26e30de·SLSA provenance 확인(게시 시각 06:54:06 UTC).
- [x] 별도 임시 작업 폴더·빈 캐시에서 npm exec --yes --ignore-scripts --package=docatlas@0.6.0으로 --version(0.6.0)·private-cloud help(종료 0)를 확인했다. 사용자 프로젝트/계정에 연결하지 않았다. GitHub 릴리스 docatlas 0.6.0(v0.6.0)을 정식 Latest로 게시·조회했다(06:54:45 UTC).

종료 기준 충족: 검사된 26e30de가 main에 있고 v0.6.0이 같은 커밋을 가리킨다. npm에서 0.6.0 설치/실행을 확인했으며 이후 main에는 배포 기록 문서만 추가한다.
실제 클라우드 계정 연결과 업로드/다운로드 인수는 이 배포의 자동 검증 결과로 대체하지 않는다.

배포 준비 변경(시작 상태와 현재 git diff/status에서 확인):

Files:
- `CHANGELOG.md` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)
- `guide/cloud-backups.md` (added)
- `package.json` (modified)
- `package-lock.json` (modified)

### Windows tar 출력 경로 보정 — 완료

Refs: RQ-24, RQ-25, DC-38, DC-41, M-23, M-24

진입/기준: 첫 배포 CI run 41591482958, a2ab079. macOS 두 조합 성공, Windows 두 조합의 cloud 테스트가 절대 출력 경로 열기 실패로 중단됐다.
시작 변경 없음. tar를 실행하는 staging cwd 기준 상대 출력 경로를 사용하도록 보정한다. 홈/문서의 한글 이름은 유지한다.
기존 한글 HOME 합성 fixture의 전체 백업/복구·실패 보존·상태 테스트가 회귀 검증이다.

- [x] Windows 시스템 tar에 전달하는 출력 인자를 상대 경로로 바꿨다.
- [x] Test Hardening: check 92 JS/다섯 쌍, Node 231/231, publish dry-run 통과. 보정 후 패키지는 62파일, 압축 97,784바이트·해제 338,525바이트다.
- [x] Integration Test(로컬): 보정 후 production tarball 통합 7/7 통과.
- [x] macOS/Windows × Node 22/24 CI 재검증 통과(run 41591966422, 26e30de). Node 24 로그의 플랫폼 테스트는 macOS 73/73, Windows 67통과·6개 OS별 제외·실패0이다. 브라우저는 각각 42개 통과했으며 네 작업 모두 pack까지 통과했다.

종료 기준: 같은 한글 HOME fixture가 네 CI 조합에서 통과하고 기존 로컬 백업/복구·다른 스킬 동작을 유지한다.

Files:
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)
- `src/private-cloud/archive.js` (modified)

## 관련 파일 표시와 파일명 검색 — 프로토타입 구현·문서 동기화

Refs: RQ-20, RQ-30, RQ-31, PR-11, DC-45, DC-46, DC-47, DC-48, DC-49, M-30, M-31, M-32, M-33

2026-11-04 사용자가 빠른 프로토타입을 먼저 요청했고 파일명 검색과 npx 용량 확인 후 기준 문서 작성을 요청했다.
과거 구현을 문서 선행 개발로 기록하지 않는다. 이번 문서 작업 시작 상태는 HEAD `ddf6e54`, 기존 프로토타입 변경 14파일이다.
`git status --porcelain -uall`, `git diff --name-status`, 미추적 목록으로 확인했다. 이번 작업은 그 파일들을 추가 수정하지 않고 기준 4종만 갱신한다.
단계별 커밋이 없어 프로토타입을 하나의 구현 단계로 기록한다. Files에는 현재 git에서 확인한 최종 경로·변경 종류를 쓴다.
중간에 잠깐 존재한 미추적 `src/server/related-files.js`는 최종 산출물이나 git rename으로 기록하지 않는다.

### 1단계 — 기록 추출·파일 패널·파일명 검색: 프로토타입 구현 완료

Refs: RQ-30, RQ-31, DC-45, DC-46, DC-47, DC-48, M-30, M-31, M-32, M-33

진입: 기존 RQ-20 기록 형식과 0.6.0 위에서 사용자가 로컬 페이지의 빠른 시제품을 요청했다.
기준: 구현 전 새 baseline 실행은 따로 보관하지 않았다. 기존 0.6.0 검증 기록은 Node 231/Chrome 42이며,
이 세션 첫 패널 프로토타입은 Node 234개, 파일명 검색 추가 후 최종은 Node 236개·Chrome 48개다. 서로 다른 시점의 수치를 섞지 않는다.

- [x] Markdown 코드 예시 제외, Refs 상속·none, 파일/폴더·이름 변경·삭제 기록, 안전한 경로와 중복 제목 앵커를 추출했다.
- [x] 수집기의 내용 해시 캐시와 직접/같은 그룹의 구현 기록 연결 함수를 문서 API·검색이 공유한다.
- [x] 닫힌 Related files 버튼, 출처 표시, 폴더/문서 묶음, 경로/단계/ID 필터, 복사·문서/단계 이동을 구현했다.
- [x] 모바일·Esc 초점 복귀·읽기/원문·스크롤/이력 보존과 자동 갱신 시 패널 필터/펼침 유지를 구현했다.
- [x] 왼쪽 검색에 현재/변경 전 파일 경로와 출처별 가중치를 추가하고 일치 경로·강조·추가 개수를 표시했다.
- [x] 원본 문서·스킬·룰·package.json/lockfile을 변경하지 않고 런타임 의존성을 유지했다.

기준 테스트: `node --test test/phase-records.test.js test/search.test.js` 7개,
`npm test` 236개, `DOCMAP_BROWSER_CHANNEL=chrome npm run test:browser` 48개, `npm run check` 98 JS·kit 1.4.0 다섯 쌍 통과.
첫 브라우저 실행의 sandbox 차단은 허용된 실행으로 확인했고, 단계명 Guest session도 필터에 맞는다는 점을 반영해
파일명을 좁히는 테스트 입력을 session.js로 고쳤다. 최종 전체 브라우저 실행은 48/48이다.

종료 기준: 합성 F-12와 실제 저장소 페이지에서 목록·검색·복사·단계 이동을 사용할 수 있고 기존 회귀가 통과한다. 프로토타입 범위에서 충족했다.
실제 페이지의 에이전트 Chrome 확인은 JS 오류 0·가로 넘침 없음이었다. 사용자의 최종 수동 UX 인수를 통과로 대신하지 않는다.

Files:
- `src/collector/phase-records.js` (added)
- `src/collector/related-files.js` (added)
- `src/collector/scan.js` (modified)
- `src/collector/search.js` (modified)
- `src/server/index.js` (modified)
- `src/web/index.html` (modified)
- `src/web/reader.js` (modified)
- `src/web/related-files.js` (added)
- `src/web/search.js` (modified)
- `src/web/styles.css` (modified)
- `test/browser/related-files.spec.js` (added)
- `test/helpers/phase-records.js` (added)
- `test/phase-records.test.js` (added)
- `test/search.test.js` (modified)

### 2단계 — 기준 문서 동기화: 완료

Refs: RQ-30, RQ-31, PR-11, DC-45, DC-46, DC-47, DC-48, DC-49, M-30, M-31, M-32, M-33

진입: 사용자가 `doc-driven-designer-v1` 기반으로 문서를 채우도록 요청했다.
기준: 네 문서에는 RQ-20의 수집·검색이 후속으로 남아 있었고, 시작 때 문서 변경은 없었다.
로컬 designer 1.3.0을 사용하며 ctxbin 동기화는 실행하지 않는다.

- [x] RQ-30·31, DC-45~49, M-30~33, F-12와 현재 구현 범위를 네 문서에 연결했다.
- [x] 직접 기록과 기능 기록, 단계 기록과 현재 Git 상태, 프로토타입과 정식 인수/게시를 구분했다.
- [x] 별도 Test Hardening·Integration Test 단계와 진입·baseline·종료 기준을 남겼다.
- [x] 실제 Files 목록·현재 인계·최신 커밋·검증 시점과 용량 비교를 기록했다.
- [x] 사용자 추가 질문인 로컬 Lithent/ftags 비교를 DC-49 TBD로 기록했다. 도입/번들링 코드는 변경하지 않았다.
  임시 비교는 현재 JS 합계 42,888/gzip 10,706바이트, 최소화 번들 26,426/8,691바이트,
  ftags 최소 예제 12,060/5,059바이트, 로컬 Lithent npm 전체 압축 405,028·해제 1,602,731바이트다.
  측정 범위·로컬 버전은 DESIGN에 기록했다. 실제 뷰어 이식/배포물과 동작 동등성을 확인한 결과는 아니다.

검증: 문서 링크·ID/Refs·단계 기록·git 변경 목록의 정합성과 문서 수집 예제를 확인한다. 결과는 아래 문서 검증 기록을 따른다.
종료 기준: 네 문서가 구현·미정·다음 작업을 같은 의미로 설명하고 문서만으로 작업을 이어갈 수 있다.

Files:
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### 3단계 — Test Hardening: 추가 검증 대기

Refs: RQ-30, RQ-31, DC-45, DC-46, DC-47, DC-48, M-30, M-31, M-32, M-33

진입: 위 프로토타입과 기준 문서가 동기화되고 DC-45·47·48의 현재 동작이 기준으로 남는다.
baseline: 1단계의 Node 236개·Chrome 48개·문법 98개. 제품 코드가 바뀌면 해당 검사부터 다시 실행한다.

- [x] 기존 자동 근거: 코드 펜스/들여쓴 예시·CRLF·경로 이탈·Refs 상속·중복 앵커·이름 변경/삭제/폴더·중복 제거·캐시 재사용.
- [x] 기존 자동 근거: 직접/기능 검색·본문 fallback·대소문자·이전 이름·독립/중첩 그룹·저장 후 검색 갱신·패널/스크롤 보존.
- [ ] 명시 none의 상속 차단, 비정상 첫 목록 항목의 블록 종료, 여러 구현 문서·Private/공개 출처 격리를 별도 사례로 확인한다.
- [ ] 일치 파일 3개 초과와 추가 개수, 긴/한글 경로, 삭제/이동 중 패널 초점·클립보드 실패 fallback의 누락 사례만 보강한다.
- [ ] F-08의 기존 300문서 검증과 별도로 단계/파일 기록이 많은 입력의 API·검색 결과 크기와 갱신 시간을 측정한다.
  현재 속도·기록 수 상한은 보장하지 않는다. 문제가 드러나면 측정 근거와 함께 설계를 갱신한다.

종료 기준: 새 기능의 경계 사례를 자동/명시적 수동 근거로 확인하고, 같은 소스에서 check·Node·Chrome 회귀를 통과한다.
새 성능 보장은 측정 전 확정하지 않는다. 아직 종료하지 않아 예정 Files 목록은 쓰지 않는다.

### 4단계 — Integration Test: 설치 근거 확보·플랫폼/수동 인수 대기

Refs: RQ-30, RQ-31, DC-45, DC-46, DC-47, DC-48, M-30, M-31, M-32, M-33

진입: Test Hardening 종료와 최종 UI 인수 범위(DC-46)가 정리된다.
baseline: 기존 `npm run test:integration` 7개는 0.6.0 게시 코드의 과거 근거이며 이번 기능 검증으로 대체하지 않는다.
당시 baseline은 개발 소스 Chrome 48/48과 pack dry-run까지였다. 후속 RQ-32에서 번들 tarball 설치 근거를 추가했다.

- [x] 개발 소스의 파일명 → 관련 문서 → 파일 기록 → 중복 제목의 단계 → 뒤로 가기와 자동 갱신 흐름을 F-12/Chrome에서 확인했다.
- [x] 0.6.0 태그와 현재 프로토타입을 같은 npm으로 pack 비교했다. 62→65파일,
  압축 97,784→103,835바이트, 해제 338,525→361,841바이트, 새 런타임 의존성 0개다.
- [x] 후속 RQ-32에서 production tarball을 별도 위치에 설치해 새 관련 파일 코드가 든 번들·문서 API·파일명 검색을 검증했다.
- [ ] 기존 integration 7개와 macOS/Windows × Node 22/24의 새 코드 검증을 수행하고 버전별/OS별 근거를 기록한다.
- [ ] M-30~33의 사람 인수와 DC-46 최종 UX를 확인한다. 미실행은 실패와 구분해 남긴다.

종료 기준: 설치본의 전체 흐름·기존 통합 회귀·대상 플랫폼 검증과 원본 보존을 확인하고, 남은 수동 인수/미지원 조건을 명시한다.
실제 게시 버전·시점은 별도 결정이다. Lithent 전환(DC-49)은 이 단계 완료의 조건이 아니다.

### 문서 검증 기록 — 2026-11-04

- [x] 기준 4종의 상대 파일/앵커 링크 29개 문제 0. 새 ID 12개(RQ 2·PR 1·DC 5·M 4) 정의와 새 절의 Refs 5줄이 일치한다.
- [x] 새 Files 블록 두 개가 git의 최종 변경 목록과 일치한다. 기존 프로토타입 14파일, 이번 문서 4파일이며 kind도 일치한다.
- [x] 두 기록 단계의 앵커가 실제 서버 렌더러의 제목 id와 일치한다. 새 문서를 스캔해 문서 5개·경고 0개를 확인했다.
- [x] `node --test test/examples.test.js` 2/2와 `git diff --check` 통과.
- [x] 이번 작업은 기준 4종만 수정했다. 제품 코드·스킬·룰·의존성·버전·배포 상태를 바꾸지 않았다.

프로토타입의 236/48은 1단계 실행 결과이며 문서만 수정한 작업에서 제품 전체 테스트를 재실행했다고 표시하지 않는다.

## UI 번들링·최소화 — 구현·자동 검증 완료

Refs: RQ-32, DC-48, DC-50, M-33, M-34

2026-11-04 사용자가 현행 DOM UI의 번들링·최소화부터 승인했다. 시작 HEAD ddf6e54,
기존 프로토타입 14파일·문서 4파일 변경을 보존하고 이 작업에서 다시 바꾼 파일만 단계 Files에 포함한다.

### 1단계 — 개발 빌드와 배포 자산: 완료

Refs: RQ-32, DC-50, M-34

진입: DC-50 사용자 승인과 네 문서의 계약 반영. baseline은 번들 전 check 98 JS·Node 236·Chrome 48,
pack 65파일·압축 103,835·해제 361,841바이트다. 같은 UI 원본을 그대로 입력으로 쓴다.

- [x] esbuild 0.28.2를 devDependency로 고정하고 build:web·prepare·check·pretest 계열·prepack을 연결했다.
- [x] 서버 고정 경로를 번들 자산으로 바꾸고 nested .npmignore로 개발 원본/기타 생성 파일을 npm에서 제외했다.
- [x] CONTRIBUTING에 빌드·원본 편집·배포 자산과 ignore-scripts의 선행 조건을 안내했다.
- [x] 생성 자산은 git 제외, 변경 시 원자적 교체, 동일 바이트 재사용과 --check를 적용했다.

결과/종료: 두 자산 생성·검사 통과, 런타임 의존성 7개 유지. 소비자 실행 경로에 esbuild import가 없다.

Files:
- `.gitignore` (modified)
- `CONTRIBUTING.md` (modified)
- `package.json` (modified)
- `package-lock.json` (modified)
- `scripts/build-web.js` (added)
- `scripts/check.js` (modified)
- `src/server/index.js` (modified)
- `src/web/.npmignore` (added)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### Test Hardening: 완료

Refs: RQ-32, DC-50, M-34

진입: 1단계 자산/서버 경로 연결. baseline은 위 Node 236·Chrome 48이다.

- [x] 서버 테스트에서 실제 응답과 번들 바이트의 일치·원본 모듈 URL 404를 확인했다.
- [x] npm run check 100 JS·kit 1.4.0, npm test 236/236, Chrome 전체 48/48 통과.
- [x] 임시 보관한 dist로 누락/오래된 자산 거부·깨끗한 재생성과 원래 바이트 일치를 확인하고 복원했다.
- [x] 첫 Node 실행의 reader.js 200 기대 1개를 새 app.js 200/reader.js 404 계약에 맞췄다. 수정 뒤 전체 236/236이다.
- [x] pack --json에서 빌드 stdout 로그가 JSON에 섞이는 것을 확인하고 로그를 stderr로 옮겨 설치 테스트의 파싱을 보존했다.

종료 기준 충족: 원문/마크다운·안전 경계·이력·선택/초점·파일 검색/패널이 최소화 자산으로 회귀를 통과했다.

Files:
- `test/server.test.js` (modified)
- `test/reading-server.test.js` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### Integration Test: 자동 검증 완료

Refs: RQ-32, DC-48, DC-50, M-33, M-34

진입: 빌드/서버/브라우저 검사 통과. baseline은 기존 integration 7개이며 현재 새 tarball은 아직 설치 검증하지 않았다.

- [x] production-only tarball 설치에 esbuild가 없고 원본 UI JS/CSS와 소스맵도 제외됐다. 소비자 설치는 --ignore-scripts 없이도 성공했다.
- [x] 설치본에서 새 파일 검색 → 관련 문서 → 파일 기록 → 구현 앵커 흐름을 추가 검증했다.
- [x] DOCMAP_BROWSER_CHANNEL=chrome npm run test:integration 8/8 통과. 기존 7개에 설치 번들 흐름 1개가 추가됐다.
- [x] npm pack dry-run/prepack/prepare와 JSON 파싱을 확인했다. 61파일·압축 100,227·해제 342,299바이트다.
- [x] JS 42,888→26,253바이트, CSS 24,076→20,940바이트. 생성 JS/CSS gzip9은 8,657/5,415바이트다.
- [x] 기준 문서·수동 체크·인계·Files를 동기화하고 기존 127.0.0.1:54878에서 최소화 자산 서버를 다시 실행했다.
- [x] 최종 문서 정합성: 상대 링크/앵커 29개, 새 ID 15개, Refs 9줄, 단계 기록/현재 git 변경 28파일의 일치와 문서 5개·경고 0개를 확인했다.

종료 기준 충족: 설치된 번들 화면이 빌드 도구 없이 동작하고 용량 측정·회귀 근거가 남았다.
원격 플랫폼 CI·실제 게시와 Lithent 도입은 별도다.

Files:
- `test/integration/package.test.js` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### 리뷰 반영 — 구현·검증 완료

Refs: RQ-30, RQ-32, DC-46, DC-50, M-31, M-34

진입: 사용자가 읽기 전용 리뷰 뒤 지적의 타당성/가치를 판단해 적용하도록 승인했다.
baseline: check 100 JS·Node 236·Chrome 48·설치 통합 8, pack 61파일·100,227/342,299바이트(압축/해제).
시작 변경 28파일을 보존하고 이 단계에서 다시 수정한 파일만 기록한다.

- [x] warning을 적용했다. 단계/문서 링크·Documentation 펼침·복사 대체 입력에 초점 키를 추가하고 대상이 사라지면 패널 검색창으로 이동한다.
  복사 대체 입력은 갱신 뒤 다시 생성해 선택 범위도 보존한다. 관련 Chrome 4개와 대상 삭제 fallback 1개가 통과했다.
- [x] suggestion을 적용했다. 닫힌 패널은 데이터·개수·출처만 갱신하고 목록은 열 때 생성한다. 변경 없는 재열기는 DOM을 재사용한다.
  처음 열기 전/닫힌 중 갱신의 DOM 부재·캐시 재사용·최신 데이터 재생성을 Chrome 1개로 확인했다.
- [x] suggestion을 적용했다. prepack 중복 연결을 없애고 prepare에서 직접 빌드한다. npm pack --json의 stderr 빌드 완료가 1회인지 설치 통합에서 확인했다.
- [x] check 100 JS·Node 236/236·설치 통합 8/8·pack 통과. 관련 파일 Chrome 12/12·전체 Chrome 54/54 통과.
- [x] 현재 pack 61파일·압축 100,464·해제 342,932바이트, JS 26,922/gzip9 8,889바이트다. 런타임 의존성 변화는 없다.
- [x] 사용자 추가 질문에 따라 최소화 후 Lithent/ftags를 같은 esbuild 설정으로 재비교했다. DC-49에 최소 예제 비용과 비교 한계를 기록했고 전환은 하지 않았다.

종료 기준: 초점이 열린 모달 안에 남고 남아 있는 대상은 복원되며, 지연 생성과 단일 빌드가 새 회귀 검사/설치본에서 확인된다.

Files:
- `package.json` (modified)
- `src/web/related-files.js` (added)
- `test/browser/related-files.spec.js` (added)
- `test/integration/package.test.js` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

## 0.7.0 배포 준비 — 버전·커밋·main 푸시

Refs: RQ-21, RQ-30, RQ-31, RQ-32, DC-51, M-20, M-33, M-34

진입: 사용자가 버전 올림과 커밋·푸시를 요청했다. 시작 HEAD와 origin/main은 ddf6e54로 일치하고 기존 변경은 28파일이다.
기능 추가이므로 0.7.0을 선택한다. 이번 범위는 main 반영까지이며 게시 태그·npm publish·GitHub 릴리스는 실행하지 않는다.
baseline은 check 100 JS·Node 236·Chrome 54·설치 통합 8개와 0.6.0 이름의 미게시 후보 pack이다.

- [x] package.json/lockfile·CLI 버전 0.7.0, CHANGELOG Unreleased와 README/문서 지도 가이드를 갱신했다.
- [x] Test Hardening: 버전 변경 뒤 check 100 JS·kit 1.4.0 다섯 쌍, Node 236/236, git diff --check 통과.
  UI 소스가 바뀌지 않아 같은 자산의 앞선 Chrome 54/54 근거를 유지하며 main CI에서 다시 검증한다.
- [x] Integration Test: 0.7.0 production tarball 설치 통합 8/8과 빌드 도구 없는 실행·CLI 버전을 확인했다.
  실제 pack은 61파일·압축 100,532바이트다. README/버전 변경을 포함하므로 앞선 0.6.0 후보 측정과 구분한다.

종료 기준: 검증한 후보의 소스/문서가 main 커밋에 포함되고 origin/main에 같은 커밋을 푸시한다.
최신 작업 기준 커밋은 ddf6e54이며 실행 커밋은 이 절을 포함한 main 커밋으로 식별한다. 태그/게시 상태는 별도로 남긴다.

Files:
- `package.json` (modified)
- `package-lock.json` (modified)
- `CHANGELOG.md` (modified)
- `README.md` (modified)
- `guide/document-map.md` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

## 0.7.0 태그 게시 — 완료

Refs: RQ-21, RQ-30, RQ-31, RQ-32, DC-51, M-20, M-31, M-33, M-34

진입: 사용자가 main 반영 뒤 태그를 푸시해 배포를 계속하도록 요청했다. 시작 HEAD/origin/main a34bc8c, 미커밋 변경 없음.
baseline: 로컬 check 100 JS·Node 236·Chrome 54·설치 통합 8개 통과. npm latest 0.6.0, 원격 v0.7.0 없음.
첫 플랫폼 CI 41779890262는 세 조합 성공, macOS/Node 24의 관련 파일 스크롤 복원 테스트 1개 실패다.

### Test Hardening — 완료

- [x] 초기 requestAnimationFrame을 지연해 기존 준비 조건 뒤 스크롤 300→0을 재현했다. 초기 제목 초점까지 기다리면 300을 유지했다.
- [x] 관련 파일 테스트의 준비 조건을 문서의 초기 위치·초점 적용 완료로 바꿨다. 임의 대기나 재시도는 추가하지 않았다.
- [x] check 100 JS·kit 1.4.0 다섯 쌍, 전체 Chrome 54/54·pack dry-run을 통과했다. 제품 소스·배포 자산은 바뀌지 않았다.
- [x] CHANGELOG를 0.7.0과 예정 게시일 2026-11-04(UTC)로 옮겼다. 이 단계의 커밋을 main에 푸시해 CI에서 검증한다.

종료 기준: 제품 소스 변경 없이 초기 렌더와 테스트 조작의 경합을 없애고 브라우저 검사 54개가 통과한다.

Files:
- `test/browser/related-files.spec.js` (modified)
- `CHANGELOG.md` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### Integration Test·게시 — 완료

- [x] fd12146의 macOS/Windows × Node 22/24 CI 네 조합이 모두 통과했다(run 41786014563).
- [x] 같은 main 커밋에 v0.7.0 태그를 만들고 그 태그만 명시적으로 푸시했다.
- [x] Publish to npm run 41786794590 성공. 2026-11-04 06:38:19 UTC에 + docatlas@0.7.0, provenance 투명성 로그 등록을 확인했다.
  npm은 처리에 몇 분 걸릴 수 있다고 안내했고 직후 버전 조회는 404였다. 실제 registry 반영과 게시본 실행은 별도로 확인한다.
- [x] registry의 0.7.0/latest·gitHead fd12146·SLSA provenance를 확인했다. 61파일·해제 343,111바이트로 후보 pack과 같다.
- [x] 저장소 밖 독립 폴더·빈 임시 캐시의 npx --yes docatlas@0.7.0 --version이 0.7.0으로 종료했다.
- [x] 결과·실제 Files·현재 인계를 동기화했다. 게시한 태그는 이동하지 않는다. 후속 문서 커밋만 main에 푸시한다.

종료 기준: 태그의 커밋과 npm gitHead가 일치하고 새 버전의 실제 CLI가 실행된다. GitHub 릴리스 생성은 이번 범위 밖이다.

Files:
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### GitHub 릴리스 노트 — 완료

Refs: RQ-21, RQ-30, RQ-31, RQ-32, DC-51, M-20, M-33, M-34

진입: npm 게시 뒤 사용자가 태그의 릴리스 노트도 요청했다. baseline: main 3c9ec9c, v0.7.0은 fd12146, GitHub Latest는 0.6.0.

- [x] CHANGELOG·실제 검증 결과를 바탕으로 기존 릴리스와 같은 영문 형식의 변경점·실행 안내·검증 링크를 작성했다.
- [x] 기존 v0.7.0 태그에 `docatlas 0.7.0`을 정식 Latest로 게시했다. 공개 조회와 본문 원본 일치를 확인했다.
- [x] 기준 4종·현재 인계·실제 Files를 동기화했다. 제품 코드와 게시 태그는 바꾸지 않았다.

종료 기준: https://github.com/superlucky84/docatlas/releases/tag/v0.7.0 에서 본문을 확인하고 draft/prerelease 없이 Latest로 조회된다.

Files:
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

## 기존 문서 활용과 문서 정비 역할 — 구현·검증

Refs: RQ-33, RQ-34, RQ-35, RQ-36, RQ-37, DC-52, DC-53, DC-54, DC-55, DC-56, M-35, M-36, M-37, M-38, M-39, M-40

상태: 2026-11-08 구현·자동/합성 검증 완료. 브랜치는 `docs/document-maintenance-plan`, 시작 HEAD는
`6b155fc`, 계획 커밋은 `09fd3e8`이다. 구현 전 Node 24.19.0/Linux에서 check와 기존 kit 테스트 47개를 통과했다.
실제 Claude Code/Codex 세션의 발견·명시 호출·장기 미호출 인수는 별도로 남긴다.

### 기준 문서 — 작성·검증 완료

진입: 기존 4종 문서·designer 스킬/룰·reviewer·agent-kit 설치/manifest와 Refs·Files 계약을 확인한다.

- [x] 사용자 지정 문서 우선과 조건부 추가 탐색, 짧은 지시 유지 요구를 RQ-33·37로 정리한다.
- [x] 문서 정비 역할의 진단·권고·선택 적용과 코드/이력 근거 경계를 RQ-34~36, DC-53~55로 정리한다.
- [x] 기본 설치 제외·`--all`/`--only` 설치는 사용자 확정으로, 이름·의존성·호출 정책·버전·반환 형식은 DC-56의 남은 TBD로 구분한다.
- [x] 구현 단계·기준 검증·종료 기준과 M-35~40을 연결한다.
- [x] 변경 구간의 ID·Refs·상대 링크·상태 표기, diff와 변경 파일 범위를 검증하고 실제 결과를 기록한다.

기준 검증: 시작 작업 트리 clean, 기존 kit 1.4.0 다섯 쌍과 기본 세 역할을 읽어 현재 상태로 기록한다.
종료: 네 문서의 요구·결정·단계·인수가 대응하고 diff가 이 네 파일에 한정된다. 스킬 구현 통과로 기록하지 않는다.

검증(2026-11-07): `git diff --check` 통과. 일회성 문서 검사로 새 ID 16개의 정의·문서 간 대응·Refs,
추가 상대 링크/앵커 3개, 현재 인계 하나와 M-35~40의 미실행 상태를 확인했다.
기존 checkAgentKit/loadKit 검사도 통과해 kit 1.4.0 다섯 쌍의 해시와 기본 세 역할을 확인했다.
제품·스킬 변경이 없어 의존성을 설치하거나 npm 전체 테스트·브라우저·설치 인수를 실행하지 않았다.
같은 날 사용자 추가 결정으로 정비자의 기본 설치 제외·`--all`/`--only` 선택 설치를 네 문서에 확정사항으로 반영했다.

Files:
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### 1단계 — designer 조건부 탐색: 구현·합성 검증 완료

진입: 기준 문서 정리 완료. 기존 탐색·배치 규칙을 유지하는 영문 두 문장 후보로 시작한다.

- [x] 기존 designer 스킬과 룰의 탐색 항목을 최소한으로 보완하고 변경 전후 문장·행·바이트 수를 비교한다.
- [x] 충분한 지정 문서에서는 추가 탐색을 요구하지 않고, 부족할 때 링크·코드 주변과 본문으로 찾게 한다.
- [x] 파일 기록이 없는 문서도 발견하며 매 작업 보고서·질문·정비자 자동 호출은 추가하지 않는다.
- [x] designer 버전·이전 해시·새 해시를 정리하고 METHOD 두 언어판의 관련 설명을 필요한 만큼 맞춘다.

기준 검증: 기존 `npm run check`와 agent-kit 관련 테스트. 파일을 고치기 전 실행 환경과 결과를 기록한다.
종료: M-35의 충분/부족/Files 없음 시나리오를 대조하고 추가 지시 분량을 확인한다. 행동 인수와 파일 검사를 구분한다.

검증: 충분한 두 문서를 지정한 독립 합성 재검증은 두 문서만 읽었고, 링크·코드 주변 문서 탐색 사례도 통과했다.
기존 두 문장 안에서 충분한 문서가 있으면 추가 탐색하지 않도록 명확히 했다. 스킬 +1행/+224바이트, 룰 +0행/+222바이트다.

Files:
- `agent-kit/skills/doc-driven-designer-v1/SKILL.md` (modified)
- `agent-kit/agents/doc-driven-designer-v1.md` (modified)
- `agent-kit/manifest.json` (modified)
- `METHOD.md` (modified)
- `METHOD.ko.md` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### 2단계 — 문서 정비 스킬·룰과 선택 설치: 구현·자동 검증 완료

진입: DC-56의 선택 설치 결정을 유지한다. 2026-11-08 정비자 1.0.0·designer 1.3.1·kit 1.5.0,
다른 스킬 의존성 없음·Codex 명시 호출 정책·다섯 절의 간결한 반환 구성을 확정해 문서에 반영했다.

- [x] 동일한 목표와 근거 기준의 스킬·서브에이전트 룰을 작성한다. 점검 결과는 범위·문제·근거·권고·질문을 포함한다.
- [x] 읽기 전용 진단과 요청한 항목 적용, 코드/문서 불일치 분류, 과거 기록·링크·기존 작업 보존을 반영한다.
- [x] 후보부터 원문으로 읽기를 좁히고 서브에이전트에는 필요한 진입점만 전달하게 한다.
- [x] manifest에 정비자를 `default: false`로 등록하고, 기본 설치 미포함·`--all` 포함·`--only` 항목 선택을 검증한다.
- [x] 필요한 호출 정책을 등록하고 해시 검증·기존 버전 교체 검사를 맞춘다.
- [x] 실제 역할·선택 설치를 README·agent-kit 안내·METHOD 두 언어판·CHANGELOG에 반영한다.

기준 검증: `test/agent-kit.test.js`, `test/agent-kit-plan.test.js`, `test/agent-kit-install.test.js`의 현재 기대를 확인한다.
종료: `npm run check`와 agent-kit 관련 테스트 통과, 기본 세 역할 유지, 선택 역할만 설치·재실행 가능(M-40).
실제 코드 점검과 문서 적용 행동은 다음 단계에서 확인하며 설치 성공만으로 완료 처리하지 않는다.

검증: check(100 JS·kit 1.5.0 여섯 쌍), kit 관련 테스트 49개와 전체 Node 테스트 238개가 통과했다.
기존 설치기는 수정하지 않았고, 비designer 네 역할의 소스·버전·해시를 보존했다. 실제 kit 1.4.0 사본은
설치 기록 유무 모두에서 designer 네 파일만 갱신 대상으로 인식하고 기본 설치에 정비자를 추가하지 않았다.

Files:
- `agent-kit/skills/doc-driven-maintainer-v1/SKILL.md` (added)
- `agent-kit/skills/doc-driven-maintainer-v1/agents/openai.yaml` (added)
- `agent-kit/agents/doc-driven-maintainer-v1.md` (added)
- `agent-kit/manifest.json` (modified)
- `agent-kit/README.md` (modified)
- `README.md` (modified)
- `METHOD.md` (modified)
- `METHOD.ko.md` (modified)
- `CHANGELOG.md` (modified)
- `test/agent-kit.test.js` (modified)
- `test/agent-kit-plan.test.js` (modified)
- `test/agent-kit-install.test.js` (modified)
- `test/integration/agent-kit.test.js` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### Test Hardening: 자동·합성 검증 완료

진입: 스킬·룰·설치 등록 구현 완료. 가상 프로젝트로 문서 오류/구현 오류/계획/판단 불가를 구분해 재현한다.

- [x] 오래됐지만 정확한 문서, 최신이지만 틀린 문서, Files 없는 문서, 과거 삭제·이름 변경 기록을 점검한다.
- [x] ID 범위 중복·상충 결정·증거 없는 과거 단계·Git 이력 부재/얕은 이력·미커밋 변경을 다룬다.
- [x] 진단 전후 작업 트리/문서 해시를 비교하고 원문 전체가 메인 결과에 복제되지 않는지 확인한다.
- [x] 선택 적용 시 기존 사용자 작업·미해결 TBD·검증 이력을 보존하고 이동 링크·앵커를 확인한다.

기준 검증: M-35~39의 합성 시나리오와 이전 단계 회귀. 새 자동 검사는 설치 등 기계적으로 검증 가능한 동작에 집중한다.
종료: `npm run check`·`npm test`와 시나리오 결과를 기록하고 모델/클라이언트별 행동과 미확인 범위를 명시한다.

합성 근거: 독립 정비자가 문서 오류(10→30초)와 구현 오류(요구 3회·구현/테스트 2회)를 구분했다.
오래된 정확한 문서·동명 ID의 다른 기능·미구현 계획·과거 rename을 오류로 단정하지 않았다. 진단 후 13개 파일 해시가
모두 같았고, D1만 적용한 뒤 DESIGN.md 하나만 바뀌었다. Git 없는 사본과 depth-1 clone도 점검했다.
특히 shallow 경계의 git show가 snapshot을 added로 보이는 것을 단계 근거로 쓰지 않고 미확인으로 반환했다.
명시 요청한 Phase 2 누락 기록은 full Git의 R100 근거로 정확히 복원 제안했고 파일은 수정하지 않았다.
M1 적용 시 중복 TIMEOUT.md만 삭제하고 README 링크만 바꿨으며 기준 문서·D1·코드·테스트·사용자 메모는 보존했다.
첫 designer 합성에서 불필요한 경로 목록 탐색을 발견해 두 문장 안에서 조건을 보완했고, 독립 재검증은 통과했다.

Files:
- `agent-kit/skills/doc-driven-designer-v1/SKILL.md` (modified)
- `agent-kit/agents/doc-driven-designer-v1.md` (modified)
- `agent-kit/manifest.json` (modified)
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

### Integration Test: 자동·합성 검증 완료, 실제 클라이언트 인수 대기

진입: Test Hardening의 필수 시나리오 통과와 남은 문제의 처리 방침 기록.

- [x] `npm pack --dry-run`과 별도 tarball/임시 HOME에서 기본·`--all`·`--only`·재설치·수정본 보호를 확인한다.
- [x] 독립 designer 합성 세션에서 지정 문서 충분/부족·Files 없는 문서의 재사용을 확인한다.
- [x] 독립 정비 서브에이전트가 진단만 반환한 뒤 선택 항목 적용을 수행하는 흐름을 격리 예제로 확인한다.
- [ ] Claude Code·Codex에서 선택 역할의 발견·호출·일반 작업 미호출을 관찰한다. 미지원 기능은 한계로 기록한다.
- [x] 런타임 의존성·패키지 증감과 지시 분량을 비교하고, 실제 에이전트 비용/정확도 개선 보장은 하지 않는다.

기준 검증: 기존 `npm run test:integration`과 M-35~40. 브라우저 코드 변경이 없으면 UI 회귀를 추가하지 않는다.
종료: 설치/검사 결과와 실제 에이전트 인수를 구분해 기록한다. 배포·전역 설치·외부 사본 갱신은 이번 계획에 포함하지 않는다.

자동 근거: production tarball 설치 통합 8개(Chromium 156.0.8078.4 포함)가 통과했다. 최종 designer 문구·해시 보완 후
check·kit 49개와 F-09 설치 통합을 다시 통과했다. F-09는 기본 12파일·--all 26파일·정비자 단독 5파일(두 클라이언트),
정비자 정책·반복 설치·문서 보존을 확인한다. Codex 단독 정비자 설치는 3파일이다. 자체 패키지는 같은 환경의 계획 커밋 대비 61→64파일,
압축 100,529→104,062바이트(+3,533), 해제 343,111→354,518바이트(+11,407)이며 런타임 의존성은 동일하다.
Codex CLI 0.159.0-alpha.3의 모델 호출 없는 prompt-input 검사에서 일반 요청에 정비자 본문이 포함되지 않음을 관찰했다.
이 관찰은 에이전트 발견·명시 호출을 입증하지 않는다. Claude Code가 없어 실제 세션 인수는 M-40에 남긴다.

Files:
- `docs/REQUIREMENTS.md` (modified)
- `docs/DESIGN.md` (modified)
- `docs/IMPLEMENT.md` (modified)
- `docs/MANUAL_TEST_CHECKLIST.md` (modified)

## 검증 예제와 기록

F-01~08의 구체적인 구성은 [수동 검증의 가상 프로젝트](./MANUAL_TEST_CHECKLIST.md#가상-프로젝트)를 따른다.
가상 예제는 저장소에 포함할 수 있는 내용으로 만들며 기업의 실제 문서를 복사하지 않는다.

### 기존 부트스트랩 — 2026-10-27

macOS / Node.js 24.21.0 / npm 11.19.0에서 실행했다.

- npm run check: CLI 진입점과 모듈 문법 검사 통과.
- npm pack: 실행 파일·모듈·4종 문서·README·AGENTS 포함 확인.
- tarball을 별도 임시 프로젝트에 오프라인 설치: 통과.
- 설치 CLI --help / --version: 종료 0, 출력 확인.
- 잘못된 인자: 종료 2, 안내 확인.
- 원본과 설치 패키지의 상대 Markdown 링크 13개: 통과.
- 공개 저장소와 초기 main push: 완료.

이는 당시 뼈대의 기록이다. Node.js 22·다른 OS·문서 수집기·브라우저 화면의
검증으로 확대 해석하지 않는다.

### 이번 문서 갱신

2026-10-27, 동일한 macOS / Node.js 24.21.0 환경에서 적용할 문서 사본을 검사했다.

- 기준 4종·README·AGENTS의 상대 링크와 앵커 19개: 통과.
- RQ/PR/DC/IC/M/F 식별자 참조, 인수 항목 15개와 가상 예제 8개: 통과.
- Phase 0~7의 기준 테스트·검증과 종료 기준: 확인.
- 사용자 선택인 포그라운드 기본 실행과 Ctrl+C 종료의 문서 간 일치: 확인.
- npm pack --dry-run: 기준 4종·README·AGENTS와 기존 CLI 파일의 포함 확인.
- 제품 인수 M-01~15: 미실행. 제품 코드와 기능 구현 상태는 이번 기록으로 바꾸지 않는다.

### Phase 1 검증 — 2026-10-27

macOS / Node.js 24.21.0 / npm 11.19.0에서 실행했다.

- npm run check: JavaScript 11개 문법 검사 통과.
- npm test: 수집·설정·메타데이터 자동 테스트 42개 통과, 실패·생략 0개.
- npm pack: 공개 API와 수집기 4개 모듈을 포함한 배포 파일 13개 확인.
- tarball을 별도 임시 위치에 오프라인 설치하고 공개 import로 F-01 문서 8개 수집: 통과.
- 패키지 설치 위치와 다른 cwd에서 기본 루트와 명시 루트의 결과 일치: 통과.
- 설치 CLI의 도움말·버전·잘못된 인자: 종료 코드와 출력 확인.
- 현재 저장소 자체의 수집: 기준 문서 4개, 그룹 2개, 경고 0개.
- 상대 링크·앵커 20개와 식별자·단계별 검증 관문 정합성: 통과.

Node 22·다른 OS와 브라우저 인수 전체는 아직 검증하지 않았다.
수집기 자동 검증을 서버·화면 기능 완료로 표시하지 않는다.

### Phase 2 검증 — 2026-10-27

macOS / Node.js 24.21.0 / npm 11.19.0 / Chrome 156.0.8078.48에서 실행했다.

- npm run check: JavaScript 18개 문법 검사 통과.
- npm test: 기존 수집기와 새 HTTP·CLI 테스트 총 55개 통과.
- npm run test:browser: 실제 Chrome 7개 통과. 카드·4종 선택·독립적인 하위 펼침,
  키보드·모바일·긴 한글 제목·삭제 안내·선택 요청 경합을 확인했다.
- 데스크톱 1440×1000과 모바일 390×844 화면을 캡처해 시각적으로 확인했다.
- npm pack: 서버 모듈과 HTML/JS/CSS를 포함한 배포 파일 18개 확인.
- tarball을 개발 의존성 없이 별도 위치에 오프라인 설치했다. 외부 cwd에서 설치 CLI 실행,
  공개 수집 API, 문서 8개, HTTP와 정적 자산·Chrome 탐색·SIGINT 종료가 통과했다.
- 문서 상대 링크·앵커 20개와 식별자·단계별 검증 관문 정합성: 통과.

일반 샌드박스는 loopback listen을 EPERM으로 차단하므로 서버·CLI·Chrome 검증은
허용된 샌드박스 밖 실행으로 수행했다. 최소 Node 22와 다른 OS의 실검증,
시스템 기본 브라우저 수동 인수는 후속으로 남긴다.
이 단계의 본문은 Markdown source이며 Phase 3의 서식·링크 기능을 완료로 표시하지 않는다.

### Phase 3 검증 — 2026-10-27

macOS / Node.js 24.21.0 / npm 11.19.0 / Chrome 156.0.8078.48에서 실행했다.

- npm run check: JavaScript 28개 문법 검사 통과.
- npm test: 수집·설정·HTTP·CLI·렌더링·참조·이미지 API 총 65개 통과.
- npm run test:browser: 기존 지도와 새 읽기 시나리오 총 16개 통과.
  표·코드·읽기 전용 체크박스·목차·이미지, 한글/중복 앵커와 직접 URL,
  링크 이동·뒤로/앞으로·지도/본문 위치·읽기/원문 모드 복원을 확인했다.
- 코드 경로 복사·범위 밖/없는 참조·이미지 오류 안내·모바일 표와 목차를 확인했다.
- 가상 프로젝트 원본 Markdown이 브라우저 검증 뒤에도 같은 내용임을 확인했다.
- npm pack: 렌더러·접근 정책·reader.js를 포함한 배포 파일 24개 확인.
- tarball을 개발 의존성 없이 별도 위치에 오프라인 설치했다. 설치 CLI로 외부 cwd의 문서 9개,
  서식·이미지·상대 링크·탐색 복원·원문 전환·Chrome 화면·SIGINT 종료를 확인했다.
- 데스크톱 1440×1000과 모바일 390×844 화면 캡처를 시각적으로 검토했다.
- 상대 링크·앵커 20개와 요구/결정/검증 식별자·단계별 관문 정합성: 통과.

서버·Chrome 검증은 loopback 바인딩이 허용된 실행에서 수행했다.
최소 Node 22·다른 OS·전체 수동 인수와 Phase 4 기능은 아직 완료로 표시하지 않는다.

### Phase 4 검증 — 2026-10-27

macOS 15.6.1 / Node.js 22.12.0 / npm 11.20.0 / Chrome 156.0.8078.48에서 실행했다.
이 단계의 실행 환경을 직접 확인했으며 이전 단계에 기록된 Node 24.21.0 환경과 구분한다.

- npm run check: JavaScript 38개 문법 검사 통과.
- npm test: 수집·설정·검색·이동 연결·실제 감지·SSE·HTTP·CLI·서식/참조 총 81개 통과.
- npm run test:browser: 기존 16개와 새 검색·갱신 시나리오 14개, 총 30개 통과.
  한글/NFC·영문 대소문자·AND·본문 코드·일치 강조·IME·낡은 검색 요청 취소를 확인했다.
- 실제 수정·추가·삭제·atomic save·연속 저장, 이미지 단독 수정·삭제, 설정/ignore 범위 변경,
  잘못된 설정의 마지막 정상 인덱스·복구, 두 감지기의 분리와 종료를 검증했다.
- 자동 갱신 중 읽기/원문 모드·스크롤·검색 입력·탐색 의도, 삭제 안내·이동된 선택의 canonical URL,
  검색 이력의 뒤로/앞으로, 두 프로젝트·같은 프로젝트의 다른 탭, SSE 재연결 후 누락 반영을 확인했다.
- native fs.watch에서 초기 파일 이벤트 뒤 약 3ms 안의 첫 저장이 누락되는 경우를 반복 재현했다.
  chokidar polling(300ms, 래스터 500ms)으로 바꾼 뒤 다중 감지·연속 저장 검증이 통과했다.
  감지 비용과 F-08 성능 기준은 Phase 5에서 측정한다.
- npm pack: 새 수집/검색·이동 연결·감지·화면 모듈을 포함한 배포 파일 30개 확인.
- 개발 의존성 없는 별도 오프라인 설치에서 외부 cwd의 설치 CLI로 문서 9개·서식/이미지/상대 링크,
  이전 경로 API·검색·직접 URL, 수정·추가·삭제 갱신과 Chrome 화면·SIGINT 종료를 확인했다.
- 데스크톱 1440×1000 검색 결과와 읽기, 모바일 390×844 화면을 캡처해 시각적으로 검토했다.
- 문서 6개·상대 링크/앵커 20개, 요구/결정/검증 식별자와 Phase 0~7 관문 정합성: 통과.

서버·Chrome은 loopback이 허용된 실행에서 검사했다. 선언한 Node 하한 22.0·다른 OS·
전체 수동 인수와 300개 문서 성능 측정은 후속 단계로 남긴다. npm 릴리스는 아직 하지 않았다.

### Phase 5 완료 검증 — 2026-10-28

사용자 요청으로 작업을 재개했다. 기준 커밋 4b8b195에서 보존 패치 대상 16개의
해시/새 파일 부재와 git apply --check를 확인한 뒤 패치를 한 번 적용했다.
아래는 재개 후 결과이며 2026-10-27의 중단 기록과 구분한다.

- npm run check: JavaScript 47개 통과(Phase 6 통합 테스트 포함).
- npm test: Node 93개 통과, 실패·생략 0개. descriptor 읽기 실패 시 닫기까지 포함한다.
- DOCMAP_BROWSER_CHANNEL=chrome npm run test:browser: Chrome 34개 통과.
- 공통 descriptor 읽기의 파일/부모 교체·경계·예외 정리와 같은 size/mtime의 내용 변경을 검증했다.
- 감지기 교체 중 종료·시작 실패·운영 중 오류 복구, SSE를 연 상태의 신호 종료·포트 재사용을 검증했다.
- 긴 한글 경로·동명 문서·120행 표·키보드·검색 포커스와 일시적 갱신 실패 재시도가 통과했다.
- npm pack --dry-run과 production-only 별도 설치 통합 검증이 통과했다. 실제 런타임 자산을 확인했다.
- 기준 4종·README·AGENTS의 상대 링크/앵커 32개, 요구/결정/인수 식별자 44개,
  Phase 0~7의 기준 검증과 종료 기준이 통과했다. 저장소 자체 수집은 문서 4개·경고 0개다.
- 문서 갱신 후 npm pack --dry-run에서 파일 35개를 확인했고 git diff --check도 통과했다.
- 초기 샌드박스 실행은 loopback listen EPERM으로 실패했으며 권한을 허용한 실행에서 전체 통과했다.
  npm pack의 기본 캐시 쓰기 EPERM은 허용된 실행과 기존 임시 캐시로 재검증했다.

#### F-08 성능 결과와 로컬 회귀 기준

명령: npm run benchmark -- --browser. 환경: macOS 15.6.1 / Darwin 24.6.0 / arm64 /
Apple M4 Pro 12 logical CPUs / 24GiB / Node 22.12.0 / Chrome 156.0.8078.48.
문서 300개(75기능×4종), 본문 5,016,514 bytes, 비문서·제외 파일 1,003개다.

수집·실시간·브라우저는 순차 실행하는 별도 새 Node 프로세스다. 준비 시간은 제외하고
파일 시스템 캐시는 따뜻한 상태이며 강제 GC는 하지 않았다. 첫 수집 1회, 이후 수집 5회,
검색 7종×10회, 저장 5회, 유휴 5초를 측정했다. 브라우저 항목은 각각 1회다.
p95는 표본의 최근접 순위이며 5회에서는 최대값과 같다. RSS에는 Chrome 자식 프로세스를 포함하지 않는다.

| 지표 | 재사용 적용 | 재사용 없음 | 채택한 로컬 회귀 기준 |
| --- | --- | --- | --- |
| 첫 수집 | 572.18ms | 518.53ms | 1,500ms 이하 |
| 후속 독립 수집 p50 / p95 | 481.17 / 497.71ms | 494.20 / 503.97ms | p95 1,000ms 이하 |
| 검색 p50 / p95 | 0.81 / 3.89ms | 0.82 / 3.91ms | p95 10ms 이하 |
| 실시간 store 시작 | 673.19ms | 1,045.17ms | 1,500ms 이하 |
| 저장→게시 인덱스 p50 / p95 | 599.30 / 631.00ms | 907.88 / 927.04ms | p95 1,500ms 이하 |
| 유휴 CPU(한 코어 기준) | 1.80% | 1.53% | 5% 이하 |
| 유휴 RSS / heap | 140.95 / 48.37MiB | 161.52 / 58.56MiB | RSS 256MiB 이하 |
| 5회 저장 후 RSS / heap | 213.89 / 115.82MiB | 222.25 / 77.86MiB | RSS 384MiB 이하 |
| 브라우저 지도 / 검색 / 문서 열기 | 61.47 / 216.61 / 109.91ms | 65.21 / 211.63 / 102.08ms | 각각 1,000ms 이하 |
| 저장→브라우저 본문 | 587.67ms | 978.16ms | 2,000ms 이하 |
| 브라우저 측정 서버 최대 RSS | 353.64MiB | 483.25MiB | 512MiB 이하 |

모든 로컬 기준을 통과했다. 비교용 사본은 createProjectStore의 scanProject 호출 4곳에서
previous 인자만 제거했다. 독립 수집은 원래 이전 세대를 넘기지 않으므로 양쪽 값 차이를
재사용 효과로 해석하지 않는다. 저장→게시 중앙값은 이번 측정에서 34.0% 줄었다.

원시 결과: [분리 성능 측정 JSON](./handoff/phase5-benchmark.json).
이 기준은 같은 예제·환경에서 수동 비교하는 회귀 기준이며 자동 테스트의 timeout이나
제품 지원 상한이 아니다. 5초 유휴·5회 저장 결과로 장시간 메모리 누수 부재를 주장하지 않는다.
장시간 안정성·다른 프로젝트/OS는 후속 검증이며 현재 재현된 미처리 결함은 없다.

### Phase 6 자동 통합 검증 — 2026-10-28

명령: DOCMAP_BROWSER_CHANNEL=chrome npm run test:integration.
이 실행은 DOCMAP_NPM_CACHE=/private/tmp/ddd-docmap-phase1-npm-cache를 사용했다.
개발 의존성 없는 production-only/offline 설치이며 브라우저 검증 도구는 개발 저장소에서만 사용했다.

- macOS 15.6.1 / Node 22.12.0 / Chrome 156: 테스트 4개(부모 1개·하위 흐름 3개) 통과.
- 같은 통합 테스트를 설치된 Node 24.22.1로도 실행해 4개 통과했다.
- tarball은 소스 저장소와 다른 임시 위치에 설치했다. 패키지 복사본과 런타임 파일 포함,
  공개 수집 API·CLI 버전·실제 HTTP·Chrome 화면을 확인했다. 검증 당시 파일 35개·76,919 bytes였다.
- JS 프로젝트의 cwd 기본 실행과 비 JS 프로젝트의 다른 cwd/--root/루트 별칭 실행에서 각각 문서 9개를 확인했다.
- 카드의 4종 선택·표·코드·체크박스·안전한 HTML 처리·등록 이미지·상대/한글 링크·뒤로 가기·이전 경로가 통과했다.
- 원본 저장 후 본문·검색 갱신·원문 모드·읽기 위치·다른 탭의 입력/문서 보존이 통과했다.
- SSE를 연 상태에서 A에 SIGINT를 보내 종료했고 B의 서버·저장 반영은 계속 동작했다. B의 SIGTERM도 종료 0이었다.
- 대상의 전체 파일 목록·내용 해시를 비교했다. 검증이 직접 저장한 두 문서 이외의 생성·수정·이동은 없었다.
- 최종 사람의 수동 인수·선언한 Node 22.0·다른 OS·시스템 기본 브라우저 열기는 미검증이다.
  Phase 6 전체 종료와 npm 릴리스는 아직 완료로 표시하지 않는다.

## 플랫폼 CI 캐시 전제 보정 — 검증 완료

진입: 사용자 보고와 run 40652167597 네 작업의 로그. 기준 커밋 a44c39e.
원인: 각 작업의 플랫폼 테스트 6개 중 5개 통과, 새 tarball production 설치만 ENOTCACHED로 실패했다.
npm ci가 받아 둔 잠금파일의 tarball만으로는 새 의존성 트리를 오프라인 해석할 메타데이터가 충분하지 않았다.

- [x] Test Hardening: 독립 빈 캐시에서 npm ci만 실행해 같은 실패를 재현한다.
- [x] 플랫폼 최초 설치를 --prefer-offline으로 보정하고 설치/실행 모드를 진단에 구분한다.
- [x] README의 설치 전제와 Windows 검증 상태를 실제 CI 결과에 맞게 안내한다.
- [x] docs/**만 바뀐 인계 커밋은 CI를 재실행하지 않도록 필터링한다.
- [x] Integration Test: 같은 캐시에서 플랫폼 6개 통과, 문법·문서·pack 검증 후 푸시하고 네 CI 작업을 확인한다.

기준 검증: 기존 플랫폼 6개·전체 Node 115개·Chrome 40개. 제품/수집기 계약은 바꾸지 않는다.
종료 기준: 새 CI의 네 조합에서 설치·브라우저·pack 단계가 실제 통과한다. 남은 실제 콘솔 인수는 별도 유지한다.

재현: /private/tmp/docatlas-clean-ci-eo4xl_09/seed에 manifest/lockfile만 복사하고 새 cache에 npm ci를 실행했다.
그 cache로 원래 test:platform을 실행해 5개 통과·production 설치 1개 ENOTCACHED 실패를 동일하게 재현했다.
수정 후 같은 cache에서 6개가 통과했고 설치 진단은 prefer-offline, 실행기 검사는 offline으로 구분했다.
문법 54개·workflow YAML/필터·pack dry-run 29개 파일·git diff --check가 통과했다. 문서 5개의 JSON 4개·로컬 링크/앵커 27개도 확인했다.

새 CI run 40657181408, 검증 커밋 967c175482c0b9fa7f71e5114f43d43a54cc20f9:

| 작업 | 실제 Node | 플랫폼 | 브라우저 | 패키징 | 결과 |
| --- | --- | --- | --- | --- | --- |
| macos-latest / Node 22 | 22.23.4 | 6개 | 40개 | 29파일 | 성공 |
| macos-latest / Node 24 | 24.22.1 | 6개 | 40개 | 29파일 | 성공 |
| windows-latest / Node 22 | 22.23.4 | 6개 | 40개 | 29파일 | 성공 |
| windows-latest / Node 24 | 24.22.1 | 6개 | 40개 | 29파일 | 성공 |

모든 작업에서 문법 54개가 통과했다. Windows의 .cmd 실행기·네이티브 한글/공백 경로와 실제 브라우저 검증이 포함된다.
기본 브라우저 자동 열기와 실제 터미널 Ctrl+C는 주입 신호·headless 브라우저로 대체 검증했다고 표시하지 않는다.

## 현재 인계

이 프로젝트의 현재 인계는 이 블록 하나다. 이전 내용은 git 이력에 남는다.

- 현재 작업(2026-11-08): RQ-33~37 구현·자동/합성 검증 완료. 브랜치는 `docs/document-maintenance-plan`이다.
- 계획 커밋: `09fd3e8`, 구현 커밋: `9026fc2`. designer 1.3.1·maintainer 1.0.0·kit 1.5.0을 구현했고 npm 버전은 0.7.0으로 유지했다.
  정비자는 기본 설치에서 제외하며 --all/--only로만 설치한다. 비designer 네 역할과 설치기·런타임 의존성은 그대로다.
- 검증: check 100 JS/kit 여섯 쌍, Node 238/238, kit 49/49, production tarball 설치 통합 8/8 통과.
  최종 designer 문구 보완 뒤 check·kit 49개·F-09를 다시 통과했다. 단계별 Files는 위 작업 절에서 Git 변경과 대응한다.
- 합성: designer 세 사례, 정비자 진단/선택 수정·과거 기록·Git 없음/shallow 검증을 독립 에이전트로 확인했다.
  일반 점검 13파일은 무변경이고 D1 적용 후 DESIGN.md만 바뀌었다. M1은 중복 문서 삭제와 README 링크만 반영했다.
  full Git의 Phase 2 누락 Files 복원 제안도 확인했다. 실제 클라이언트 인수와 합성 결과는 구분한다.
- 용량: 계획 커밋 대비 압축 +3,533/해제 +11,407바이트, 파일 61→64. 기본 지시 증가는 designer 두 문장뿐이다.
- 다음: M-39·40의 실제 Claude Code/Codex 세션 발견·명시 호출·일반 작업 미호출을 확인한다.
  Codex 0.159.0-alpha.3 prompt-input의 일반 본문 미포함만 관찰했고 Claude Code는 설치돼 있지 않다.
- 기존 후속: DC-46 최종 UX·DC-49 프레임워크 검토와 기존 플랫폼/클라우드 인수는 각 작업 절의 상태를 유지한다.
- 커밋: 계획과 구현을 위 두 커밋으로 분리했고 인계 확인은 후속 문서 커밋에 남긴다.
  npm 게시·main 병합·푸시·전역 설치·외부 사본 갱신은 하지 않았다.
- 차단: 구현의 기술적 차단 없음. 실제 클라이언트 인수는 위 환경 한계에 따라 남겨둔다.
