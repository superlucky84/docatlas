# docatlas 설계

문서 기준: 2026-11-08.
[요구사항](./REQUIREMENTS.md) · [구현 계획](./IMPLEMENT.md) · [수동 검증](./MANUAL_TEST_CHECKLIST.md)

수집 API·포그라운드 CLI·카드 지도와 Markdown 서식 읽기가 동작한다.
상대 문서·앵커·목차·이미지와 읽기/원문 전환, 뒤로/앞으로 가기를 지원한다.
검색·변경 감지·명시적인 문서 이동 연결은 Phase 4에서 구현했다.
Phase 5에서 descriptor 읽기·세대별 메타데이터 재사용·종료 경합·화면 복구를 보강했다.
Phase 6의 설치 통합 검증이 Node 22.12.0·24.22.1 / macOS / Chrome에서 통과했다.
2026-11-04 RQ-30·31의 관련 파일·왼쪽 파일명 검색을 프로토타입으로 구현했다.
현재 동작을 아래 계약으로 문서화하며 최종 UX·추가 경계·원격 플랫폼 인수는 아직 완료하지 않았다.
RQ-32 번들링·최소화와 별도 tarball 설치 인수는 후속 단계에서 완료했다.
2026-11-08 RQ-33~37을 kit 1.5.0으로 구현·자동/합성 검증했다. 실제 클라이언트 인수는 M-35~40에서 구분한다.

## 구조와 책임

단일 설치 패키지 내부에서 책임을 나눈다. 처음부터 여러 배포 패키지를 만들지 않는다.

```text
CLI ── 프로젝트 루트·실행 상태
 │
 ├── 수집기 ── 파일 발견·문서 분류·계층·제목/설명
 │       └── 인덱스 ── 지도 모델·검색용 본문
 │
 └── 로컬 서버 ── 패키지의 웹 화면·문서 API
          └── 브라우저 ── 지도·문서 선택·Markdown
                 ↑
           변경 감지 후 갱신
```

수집기는 브라우저와 CLI 실행 방식에 의존하지 않게 한다.
화면은 파일 시스템에 직접 접근하지 않고 서버가 제공하는 읽기 모델을 사용한다.
파생 인덱스를 잃어도 원본과 선택 설정으로 재생성할 수 있어야 한다.
RQ-16·17: src/agent-kit/은 스킬 원본 읽기와 설치 판정을 맡는다(2단계 구현). 수집기·서버·화면과 독립이며 서버는 사용하지 않는다.
CLI의 docatlas agents 하위 명령이 이 모듈을 사용한다(3단계 구현).

## 프로젝트 루트와 식별

수집기와 CLI는 다음 프로젝트 루트 규칙을 사용한다.

- 기본 루트는 명령을 실행한 cwd다. --root로 다른 루트를 지정할 수 있다.
- 루트는 실제 절대 경로로 정규화하고 디렉터리인지 확인한다.
- 같은 실제 경로의 심볼릭 링크 별칭은 같은 프로젝트로 취급한다.
- 서로 다른 경로의 프로젝트·worktree는 각각 구분한다.
- 화면에는 프로젝트 이름과 루트 경로를 확인할 수 있는 위치를 둔다.
- 설치 패키지 디렉터리에서 대상 프로젝트를 추론하지 않는다.

프로젝트 id는 실제 루트의 SHA-256 해시다. 문서·그룹 id는 프로젝트 루트에 대한
상대 경로를 사용하며 구분자는 /로 통일한다. 파일 이동 후 id 유지까지 보장하지 않는다.

## 발견 규칙 — Phase 1

기본 후보:

1. 어떤 깊이에 있든 docs 디렉터리 아래의 .md 파일.
2. docs 밖에서도 REQUIREMENTS.md, DESIGN.md, IMPLEMENT.md, MANUAL_TEST_CHECKLIST.md.
3. 선택 설정의 include에 지정한 Markdown. include는 기본 목록을 대체한다.

표준 파일명과 .md 확장자 인식은 대소문자를 무시한다.
같은 kind의 파일이 여러 개여도 실제 경로별 문서로 유지한다.

.git과 node_modules는 항상 제외한다. 기본 산출물 제외는 dist, build,
coverage, .docatlas, .ddd-docmap이다. 다음 후보에서는 아래 Python·Java 제외를 추가한다.
선택 설정의 exclude는 산출물 제외 목록을 대체하며
항상 제외할 디렉터리에는 영향을 주지 않는다.

Git 유무와 관계없이 .gitignore를 디렉터리별로 읽으며 Git 실행 파일은 필요 없다.
정확한 우선순위와 중첩 규칙은 아래 Phase 1 구현 계약을 따른다.

파일·디렉터리 심볼릭 링크는 수집하지 않고 상대 경로로 경고한다.
어떤 파일을 읽더라도 실제 경로가 프로젝트 경계를 벗어나면 제외한다.

## 기능 묶음과 상하위

- 문서를 가진 디렉터리 하나를 문서 그룹으로 만든다.
- 그룹은 원본 상대 디렉터리 경로를 유지한다.
- 그룹 사이의 경로를 잇는 상위 디렉터리는 구조 그룹으로 표현할 수 있다.
- 문서가 있는 상위 그룹도 자식을 가질 수 있다.
- docs 같은 구조용 경로를 화면에서 생략하더라도 원본 경로와 id는 보존한다.
- 첫 버전의 설정은 그룹의 이름·설명을 보정한다. 임의의 부모 재배치는 후속 검토다.
- 동명 그룹은 소속 경로로 구분한다.

요구사항·설계·구현·수동 검증을 이 순서로 표시하고, 이어 README·RESEARCH·그 외 문서를
표시한다. 일부 문서만 있어도 정상 그룹이다. 구조 그룹에는 없는 문서 버튼을 만들지 않는다.

## 제목과 설명 — Phase 1

대표 문서는 README → REQUIREMENTS → DESIGN → IMPLEMENT →
MANUAL_TEST_CHECKLIST → RESEARCH → 그 외 경로순으로 고른다.

- 제목: 설정 보정 → 대표 문서의 첫 H1 → 폴더명.
- 문서 제목: 첫 H1 → 파일명.
- 설명: 설정 보정 → 대표 문서의 첫 설명 문단.
- 설명 문단에서는 코드 블록·표·제목·참조 링크만 있는 문단을 제외한다.
- 문서 기준·작성일·상태 같은 메타데이터 문단도 설명 후보에서 제외한다.
- 텍스트를 얻지 못하면 설명을 비워 두고 임의의 요약을 생성하지 않는다.
- 카드에서는 한 줄로 생략 표시하고 전체 설명은 상세 영역에서 확인한다.
- 그룹 제목에서 구분자·공백 뒤의 알려진 문서 종류 접미사를 정리한다.
  H1이 없거나 정리 결과가 비면 폴더명을 쓴다. 원래 문서 제목은 보존한다.
- 선두 YAML front matter 블록을 건너뛰며 그 안의 메타데이터는 해석하지 않는다.

자동 추출 결과를 사람이 보정할 수 있게 하되, 모든 문서에 설명을 새로 쓰는 절차를 요구하지 않는다.

## 선택 설정 — Phase 1

0.2.0부터 프로젝트 루트의 docatlas.config.json을 먼저 읽는다.
없을 때만 ddd-docmap.config.json으로 fallback한다. 둘 다 있어도 병합하지 않고 새 파일만 사용한다.
새 파일의 파싱·타입·심볼릭 링크 오류가 있으면 이전 파일로 우회하지 않는다.
JSON 데이터만 읽으며 프로젝트의 JavaScript/TypeScript 설정을 실행하지 않는다.

```json
{
  "version": 1,
  "include": [
    "**/docs/**/*.md",
    "**/REQUIREMENTS.md",
    "**/DESIGN.md",
    "**/IMPLEMENT.md",
    "**/MANUAL_TEST_CHECKLIST.md"
  ],
  "groups": {
    "docs/catalog": {
      "title": "콘텐트 목록",
      "summary": "목록의 구성과 표시 규칙"
    }
  }
}
```

설정이 없으면 기본값을 사용한다. include가 있으면 기본 포함 패턴을 대체한다.
groups의 키는 원본 상대 디렉터리다. 루트 그룹 키는 .이다.
redirects는 이전 Markdown 상대 경로를 현재 Markdown 상대 경로에 연결하는 선택 객체다.
예: {"docs/old/DESIGN.md": "docs/new/DESIGN.md"}. 체인은 최종 문서로 정규화한다.
잘못된 타입·알 수 없는 설정 버전은 경로와 항목을 안내하고 시작을 중단한다.
존재하지 않는 그룹 보정은 UNMATCHED_GROUP 경고로 남긴다.
잘못된 설정과 루트는 각각 ConfigurationError와 ProjectError로 구분한다.
설정 파일은 심볼릭 링크가 아닌 일반 파일만 허용한다.

## 수집 범위 옵션 — 0.2.0 계약

- --docs-dir <directory>는 반복 가능하며 프로젝트 루트 기준의 리터럴 상대 경로다.
  기존 JSON include 또는 기본 포함 범위에 해당 디렉터리 아래 .md를 추가한다. 부모/절대 경로와 역슬래시는 거부한다.
  공백·한글·glob처럼 보이는 문자를 실제 디렉터리 이름으로 취급한다. .은 루트 안의 전체 디렉터리를 뜻한다.
- 없는 폴더·제외된 폴더·심볼릭 링크는 범위를 우회하지 않는다. 탐색되지 않은 추가 경로는 DOCS_DIR_SKIPPED 경고로 표시한다.
  이후 폴더가 생성·삭제되면 다음 세대에서 반영하며 없는 폴더 때문에 마지막 정상 지도를 붙잡지 않는다.
- --all-md는 JSON include보다 우선해 모든 .md를 포함 후보로 삼는다. --docs-dir와 함께 주면 추가 경로는 범위를 더 넓히지 않는다.
- 최종 우선순위는 고정 제외 → .gitignore → JSON exclude → 포함 후보다.
  --all-md/--docs-dir/include 어느 것도 node_modules·.git이나 제외 정책·루트 경계를 우회하지 않는다.
  JSON exclude가 있으면 기본 exclude 목록을 대체한다. 기본값에 .docatlas와 이전 .ddd-docmap을 모두 제외한다.
- 새 설정과 이전 설정 파일의 생성·수정·삭제를 모두 감지한다. 재수집과 감지기 교체에도 실행 옵션을 유지한다.
- 공개 API는 collectProject(root, { docsDirs: ['documentation'], allMarkdown: false })다.
  수집 옵션은 서버/CLI와 독립적인 데이터이며 실행 중 외부 변경으로 바뀌지 않게 복사한다.
  잘못된 옵션은 CollectionOptionsError이며 CLI는 인자 오류와 같은 종료 2로 안내한다.
- README·--help는 설정 파일 선택과 version/include/exclude/groups/redirects의 의미·기본값 대체·예제를 설명한다.
  사용자 선택으로 팀 가이드의 기본 명령은 npx docatlas다. 릴리스 번호를 고정하지 않고 필요 시 @latest 실행과 로컬 설치본 갱신을 설명한다.

## Python·Java 기본 제외와 Windows 점검 — 다음 후보 계약

- 기본 exclude에 **/.venv/**, **/venv/**, **/__pycache__/**, **/.pytest_cache/**,
  **/.mypy_cache/**, **/.ruff_cache/**, **/.tox/**, **/.nox/**, **/.eggs/**, **/*.egg-info/**,
  **/target/**, **/.gradle/**, **/.m2/**를 추가한다. 모든 깊이에 적용하고 기존 기본값을 유지한다.
- DC-24: 0.3.0 이후 기본 exclude에 **/.conda/**를 더한다. 같은 규칙(모든 깊이·대소문자 무시·대체 가능한 기본값)을 따른다.
  conda 환경을 이름으로 알아내는 다른 방법(conda-meta 폴더 감지 등)은 쓰지 않는다. env 같은 일반 이름은 계속 제외하지 않는다.
- 고정 제외로 승격하지 않는다. include/--docs-dir/--all-md는 기본 제외를 우회하지 않으며,
  명시적 exclude 배열은 기존 계약대로 기본 목록을 대체한다. exclude: [] 재포함도 검증한다.
- 소스 언어·패키지 manifest의 유무로 문서를 분류하지 않는다. Python/Java/Gradle 코드·설정을 실행하지 않는다.
  env/bin/out/vendor, target-design/venv-guide 같은 유사 이름과 업무 문서는 과도하게 제외하지 않는다.
- Windows --root에는 네이티브 드라이브/역슬래시/공백 경로를 허용한다. JSON·--docs-dir·문서 id·Markdown 링크는 / 규칙을 유지한다.
  내부 파일 경로는 node:path, 공개 id/링크는 POSIX 경로를 사용한다. 드라이브 밖 경로·링크 읽기를 허용하지 않는다.
- npm의 Windows 실행 shim은 npm CLI를 Node로 실행해 검증한다. .cmd를 Unix 실행 파일/심볼릭 링크로 가정하지 않는다.
- 터미널 Ctrl+C와 테스트의 subprocess.kill('SIGINT')를 구분한다. Windows 프로그램 종료는 후자가 강제 종료이므로 정상 정리 증거로 쓰지 않는다.
  자동 검증은 run의 주입 신호로 정리 경로를 확인하며 실제 콘솔 Ctrl+C는 별도 수동 관문으로 둔다.
- macOS/Windows의 Node 22·24 플랫폼 검증과 브라우저 CI를 준비한다. 원격 실행 전에는 Windows 통과나 공식 지원을 주장하지 않는다.
  네이티브 Windows 실행·PowerShell/CMD·기본 브라우저·Ctrl+C·UNC/네트워크 드라이브 인수는 TBD다.
  Windows CI 대상은 test:platform과 test:browser다. 기존 npm test/test:integration에는 POSIX 심볼릭 링크·강제 신호 전제가 남아 있어 전체 Windows 통과를 주장하지 않는다.

근거: [Python venv](https://docs.python.org/3.14/library/venv.html),
[Maven target](https://maven.apache.org/guides/introduction/introduction-to-the-standard-directory-layout.html),
[Gradle 디렉터리](https://docs.gradle.org/current/userguide/directory_layout.html),
[Node 신호](https://nodejs.org/api/process.html#signal-events).

## 읽기 모델 — Phase 1

| 모델 | 필드 초안 | 의미 |
| --- | --- | --- |
| Project | id, displayName, rootLabel | 실행 대상과 화면 식별 |
| FeatureGroup | id, parentId, sourceDirectory, title, summary, documentIds, childIds, isStructural | 문서 묶음 또는 구조 그룹 |
| SourceDocument | id, relativePath, groupId, kind, title, summary, canonicalId, contentHash | 파일별 메타데이터 |
| IndexSnapshot | revision, project, groups, documents, redirects, warnings | 화면에 일관되게 전달할 스냅샷 |

본문은 선택 시 읽거나 별도 인덱스에서 제공한다. 지도 목록에 전체 본문을 항상 싣지 않는다.
원본 Markdown, 렌더링 결과, 검색용 일반 텍스트를 구분한다.
그룹·문서는 같은 입력에 같은 순서로 정렬한다. revision은 프로젝트·메타데이터·내용 해시·
그룹·경고의 SHA-256이며 시각 정보를 넣지 않는다. canonicalId는 명시적인 이전 문서의 최종 대상 id이며 일반 문서는 null이다.
IndexSnapshot은 redirects 배열(source/targetId)을 포함하며 본문은 별도 내부 인덱스에 둔다.

## 지도와 읽기 화면

```text
[ 프로젝트 이름 ]                       [ 문서 검색 ]

문서 지도                         │ 선택한 문서
▾ 콘텐트 목록                     │ 제목 · 소속 경로
  목록의 구성과 표시 규칙          │ 목차
  [요구사항] [설계] [구현] [검증]   │
  ▸ 필터                          │ Markdown 본문
▸ 공통 계약                       │
```

- 화살표는 자식 그룹을 펼치고 접는다.
- 카드 본문은 해당 그룹의 문서 선택 항목을 펼친다.
- 문서 선택 항목은 본문을 연다. 현재 선택을 시각적으로 표시한다.
- 제목·설명이 있는 얇은 가로 카드를 기본 형태로 사용한다.
- 지도와 본문의 스크롤은 독립적으로 유지한다.
- 넓은 화면은 분할 배치, 좁은 화면은 지도/본문 전환을 제안한다.
- 트리 펼침, 문서 선택, 뒤로 가기를 키보드로 조작할 수 있게 한다.
- 이동 후 선택 문서가 삭제되면 빈 본문과 삭제 안내를 표시한다.
- 문서 0개이면 발견 규칙과 설정 위치를 안내한다.

Phase 2에서는 지도 폭 410px(넓은 화면 440px), 기본 카드 높이 57px를 사용한다.
900px 이하에서는 지도/본문을 전환한다. 기본 HTML 버튼으로 Tab·Enter·Space를 지원한다.
지도 스크롤·펼침·선택을 현재 페이지에서 유지한다. 본문·원문 모드의 위치와 브라우저 뒤로/앞으로 가기는 Phase 3에서 구현했다.

## Markdown과 링크 — Phase 3

표·코드 블록·제목 앵커·일반 목록을 지원한다.
markdown-it 15.0.3의 html:false로 raw HTML을 텍스트로 처리한다.
표·코드·읽기 전용 작업 체크박스를 렌더링한다. 코드 블록에는 언어와 구분된 배경을 표시한다.
github-slugger 2.0.0으로 한글·중복 제목을 구분한다. 내부 DOM id는 heading- 접두사를 써서
화면 요소와 충돌하지 않으며 URL의 앵커는 원래 slug다.

링크는 브라우저의 화면 URL이 아니라 원본 문서 디렉터리를 기준으로 해석한다.

| 대상 | 현재 동작 |
| --- | --- |
| 수집된 Markdown | 같은 뷰어에서 이동하고 브라우저 뒤로 가기 지원 |
| 같은 문서의 앵커 | 해당 제목으로 스크롤 |
| 루트 안의 허용된 래스터 이미지 | 원본 기준 경로로 검사·등록하고 이미지 API로 표시 |
| 수집 범위 밖의 Markdown | 상대 경로와 수집 범위 안내 |
| 코드·지원하지 않는 첨부 | 경로 표시·복사. RQ-30의 Files 기록도 경로만 제공 |
| 외부 http/https | 외부 링크로 열기 |
| 존재하지 않거나 제외된 대상 | 이유를 안내하고 현재 문서를 유지 |

로컬 PNG/JPEG/GIF/WebP/AVIF를 제공한다. SVG·외부·data 이미지는 안내로 대체한다.
등록한 이미지 id만 /api/asset에서 읽고 각 요청에 고정 제외·ignore·설정 제외·실제 경로를 재검증한다.
파일 경로와 앵커는 한 번 디코딩하며 로컬 query는 경로 매칭에 사용하지 않는다.
프로젝트 밖 경로와 임의 프로토콜을 읽거나 실행하지 않는다.

## CLI와 서버 수명주기 — Phase 2

아래 인터페이스와 --help/-h, --version/-v를 지원한다.
2026-10-28 사용자 선택으로 기본 명령을 docatlas로 변경한다. docmap·ddd-docmap은 호환 이름으로 유지한다.

```sh
docatlas
docatlas --root ./some-project
docatlas --no-open
```

package.json의 세 bin 이름을 같은 bin/docatlas.js에 연결한다. 이전 bin/ddd-docmap.js는 호환 진입점으로 둔다.
개발 의존성으로 설치하면 실행 파일은 node_modules/.bin에 생긴다. npm은 npx --no-install docatlas 또는
scripts의 "docatlas": "docatlas"와 npm run docatlas로, pnpm은 pnpm docatlas로 실행한다.
사용자는 프로젝트별 설치 후 npx / pnpm으로 실행하는 방식을 선택했다.
일반 셸의 PATH를 자동 변경하거나 전역 런처를 추가하지 않는다.
도움말·브라우저 브랜드·제목·서버 안내는 docatlas를 기본 이름으로 쓰고 도움말에 기존 이름을 표시한다.

사용자 선택에 따라 기본 실행은 포그라운드다. 브라우저를 연 뒤에도 터미널에서
서버를 유지하며 Ctrl+C로 종료한다. --no-open은 브라우저를 열지 않고 주소를 출력한다.

- 서버는 loopback에 바인딩하고 OS가 선택한 사용 가능한 포트를 이용한다.
- 실행한 프로세스 하나가 자신의 서버와 변경 감지를 소유한다.
- 여러 번 실행하면 각각 별도 서버를 열며, 실행 중인 다른 서버를 재사용하지 않는다.
- Ctrl+C와 종료 신호를 받으면 자신의 서버·감지기·타이머를 정리한다.
- 종료는 다른 터미널에서 실행한 서버나 무관한 프로세스에 영향을 주지 않는다.
- 브라우저 열기 실패 시 서버 주소와 안내를 출력해 직접 접속할 수 있게 한다.
- 시작 성공은 서버 준비 확인 후 알린다. 시작 대기 시간은 측정 후 정한다.
- 종료 코드 초안: 성공 0, 실행 실패 1, 인자·설정 오류 2.

정상 종료와 도움말·버전은 종료 0, 실행 실패는 1, 잘못된 인자·설정·루트는 2다.
브라우저는 open 10.2.0에 위임한다. 준비 전에는 열지 않으며 열기 실패 시 서버를 유지한다.
SIGINT·SIGTERM의 정상 정리를 자동 검증했다. 지원 OS의 최종 실검증 범위는 IC-03·DC-10에서 관리한다.
백그라운드 실행·서버 재사용·stop/status 명령은 첫 버전의 범위 밖이다.
3단계 구현: 위치 인자를 받지 않는 계약의 예외로 agents 하위 명령 하나만 받는다. 세부는 아래 에이전트 스킬 설치 계약을 따른다.

## 검색·갱신·탐색 상태 — Phase 4 계약

PR-02·05·06·08 / DC-09, IC-03에 대응한다. 아래 계약으로 구현했고 Node와 Chrome에서 검증했다.

- 제목·기능명·경로(이전 경로 포함)·설명·본문의 일반 텍스트를 NFC와 영문 소문자로 정규화한다.
  RQ-31 프로토타입은 아래 관련 파일 계약에 따라 Files의 현재/변경 전 경로도 같은 검색에 추가한다.
  공백으로 구분한 모든 검색어가 일치해야 한다. 메타데이터 일치를 본문보다 우선하고 동점은 상대 경로순이다.
  검색어는 200자 이하, 결과는 최대 50개와 전체 일치 수를 제공한다. 빈 검색은 계층 지도를 보여준다.
- /api/search?q=는 소속·일치 필드·약 160자 문맥을 반환한다. 본문 전체를 지도 API에 싣지 않는다.
  화면은 텍스트와 mark 요소로 일치를 표시하고 입력 중인 IME·취소된 요청을 구분한다.
- chokidar 5의 polling(일반 경로 300ms, 래스터 500ms)과 저장 안정화 100ms, debounce 150ms로 직렬 재수집한다.
  macOS native fs.watch에서 초기 파일 이벤트 직후 3ms 내 저장이 누락되는 것을 재현해 polling을 채택했다.
  제외 경로와 비관련 파일은 감지하지 않는다. 큰 프로젝트의 감지 비용은 Phase 5에서 측정한다. 지도·검색·본문을 같은 세대에서 교체한다.
  /api/map, /api/search, /api/document에는 실행 내 증가하는 sequence를 제공한다.
  본문 해시 기반 revision과 이미지·참조 변경도 포함하는 sequence를 구분한다.
- /api/events의 SSE ready/change/update-error로 갱신한다. 재연결 ready에도 현재 세대를 실어 유실을 복구한다.
  수집 실패·잘못된 설정은 마지막 정상 인덱스를 유지하고 화면에 오류를 표시한다. 설정을 고치면 복구한다.
- 고정 제외·ignore·exclude 정책을 감지에도 적용한다. 설정과 .gitignore 변경은 감지 범위를 다시 만든다.
  서버 종료 시 SSE·감지기·타이머를 정리한다. 다른 서버와 탭의 상태는 메모리로 분리한다.
- 갱신 시 지도 펼침·검색어·선택·읽기/원문 모드·스크롤을 남아 있는 항목에서 보존한다.
  선택 문서가 삭제되면 낡은 본문을 지우고 경로와 안내를 남기며 다른 문서를 선택할 수 있다.
  진행 중인 사용자 문서 이동을 자동 갱신이 덮어쓰지 않는다. 영구 저장소에는 본문을 복제하지 않는다.
- redirects의 경로·타입 오류는 설정 오류다. 순환·자기 참조·없는 대상·제외된 이전 경로는 경고 후 연결하지 않는다.
  유효한 연결은 카드/검색에서 최종 문서를 한 번 표시하며 이전 경로 검색·URL·상대 링크도 최종 문서로 연다.
  이전 파일이 없어도 명시적인 연결은 유지한다. 실제 파일이나 문장의 이동 안내만 보고 추론하지 않는다.
- 기술 근거: [chokidar](https://github.com/paulmillr/chokidar),
  [Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html).

## 검색 결과의 경로 탐색 — 0.2.0 추가 계약

- 검색 결과마다 루트 기준 원본 경로 전체를 별도 버튼으로 표시한다. 문서 열기 버튼 안에 버튼을 중첩하지 않는다.
  제목·소속·일치 문맥은 본문 열기, 경로의 Show in tree는 지도 위치 탐색으로 구분한다.
- 경로를 누르면 입력·검색 결과를 즉시 비우고 진행 중인 검색을 취소한다. 늦은 검색 응답으로 목록이 다시 나타나지 않는다.
- 현재 지도에서 최종 문서 id를 확인하고 상위 그룹을 모두 펼친 뒤 소속 그룹의 문서 목록을 연다.
  대상 문서 버튼을 지도 스크롤 영역 안으로 이동하고 초점과 테두리 강조를 준다. 실제 읽는 문서의 선택 표시와 구분하고 갱신에도 유지한다.
  읽고 있던 본문·모드·읽기 스크롤·URL/이력은 유지한다.
  좁은 화면은 지도를 표시한다. 경로 찾기는 새로운 문서 열기를 시작하지 않는다.
- 진행 중인 사용자 본문 열기가 경로 찾기 이후 트리를 다시 바꾸지 않도록 취소한다. 자동 갱신은 현재 지도/본문 상태를 보존한다.
- 검색 결과의 문서가 갱신에서 사라지면 임의의 다른 문서를 찾지 않고 현재 지도와 안내를 표시한다.
  이전 경로 검색도 현재 문서의 실제 경로로 이동한다. docs 구조 경로 생략·루트 문서·동명/한글/긴 경로를 처리한다.
- 두 검색 버튼은 Tab과 Enter/Space로 사용할 수 있다. 갱신 뒤 초점은 같은 문서의 같은 동작으로 돌아가며 삭제되면 검색창으로 복구한다.
  긴 경로는 줄바꿈하며 모바일에서도 가로 넘침이나 본문으로의 강제 전환을 일으키지 않는다.

## 에이전트 스킬 설치 — 다음 후보 계약

대응: RQ-16·17·18 / PR-09·10 / DC-16~19 / M-16·17. 구현·자동 검증 후 PR #1이 main에 병합됐다.
다음 배포 후보 0.3.0에 포함한다. 확인된 결정과 설계 제안을 구분한다.

### 확인된 결정 — 2026-10-28

- 원본은 agent-kit/의 designer·implementer·reviewer 스킬과 에이전트 룰이다. Confluence·ctxbin은 배포본이다.
- docatlas 하위 명령으로 설치한다. Claude 플러그인 마켓플레이스와 ctxbin 전용 방식은 채택하지 않았다.
  마켓플레이스는 Claude 전용이고 스킬 이름에 플러그인 접두사가 붙는다. ctxbin은 팀원에게 원격 저장소 접근이 필요하다.
- 기본 위치는 사용자 전역이고 프로젝트 설치는 옵션이다. 갱신은 같은 명령을 다시 실행하는 것이다.
- 기본 대상은 designer 한 쌍이다. implementer·reviewer는 명시적으로 선택한다.
- 팀 배포는 당분간 Confluence 사본을 유지한다. docatlas 설치 안내 시점은 사용자가 정한다.
- 공개 저장소와 npm 패키지에 스킬·룰 원본을 포함한다(DC-19).
- 에이전트가 설치를 대신 실행하도록 에이전트용 도움말과 대화형 질문 없는 출력을 제공한다(RQ-18).

### 클라이언트 위치와 같은 이름 규칙

2026-10-28 Claude Code·Codex 공식 문서에서 확인했다. 문서에 없는 Codex 룰 규칙은 Codex CLI 0.165.0에서 관찰했다(DC-18).
클라이언트 규칙이 바뀌면 다시 확인한다.

| 항목 | 전역 (기본) | 프로젝트 (옵션) | 같은 이름일 때 |
| --- | --- | --- | --- |
| Claude 스킬 | ~/.claude/skills/<name>/SKILL.md | <root>/.claude/skills/<name>/SKILL.md | 전역 우선 |
| Claude 룰 | ~/.claude/agents/<name>.md | <root>/.claude/agents/<name>.md | 프로젝트 우선 |
| Codex 스킬 | ~/.agents/skills/<name>/SKILL.md | <root>/.agents/skills/<name>/SKILL.md | 합치지 않고 둘 다 표시 |
| Codex 룰 | ~/.codex/agents/<name>.toml | <root>/.codex/agents/<name>.toml | 프로젝트 우선. 프로젝트 룰은 신뢰한 프로젝트에서만 읽음 (DC-18) |

전역 사본이 있는 사용자에게는 프로젝트 설치만으로 Claude 스킬 갱신이 전달되지 않는다. 이것이 전역 기본의 근거다.
Codex 룰은 name·description·developer_instructions를 가진 TOML이다. 원본 Markdown 본문을 developer_instructions로 변환한다.
본문은 TOML 여러 줄 literal('''…''')로 쓰고, '''나 TOML이 허용하지 않는 제어 문자가 있으면 escape한 기본 문자열로 쓴다(2단계 구현).

### 원본 형식 — 1단계 구현됨

- agent-kit/skills/<name>/SKILL.md와 agent-kit/agents/<name>.md에 둔다. 룰의 frontmatter에는 name·description만 쓴다.
- 원본 파일에 docatlas 전용 표시를 넣지 않는다. Confluence에서 복사한 사본과 설치본이 같아야 한다.
- frontmatter는 최상위 key: value와 두 칸 들여쓴 한 단계 map만 쓴다. 값은 따옴표 없는 문자열이나 큰따옴표 문자열이다.
  ": "·" #"·true·숫자처럼 YAML이 문자열로 읽지 않을 값은 큰따옴표로 감싼다.
- agent-kit/manifest.json(schema 1)은 kitVersion과 items를 가진다. 항목은 name·version·default·skill/agent의 path·sha256·previous다.
  선택 key `requires`(RQ-22 4단계)는 이 항목이 기대는 다른 항목 이름의 목록이다. 이름은 manifest에 있어야 하고 자기 자신이나 중복은 안 된다.
  설치 동작은 바꾸지 않고, agents help의 항목 줄에 `needs <이름>`으로 보여 준다.
  previous 항목은 version·kind(skill/agent/codex-agent)·part(file/body)·sha256·source이며 현재보다 낮은 버전이어야 한다.
- 해시는 BOM을 지우고 CRLF/CR을 LF로 바꾸고 끝 공백을 지운 뒤 개행 하나를 붙인 UTF-8의 SHA-256이다.
  본문 해시는 frontmatter 뒤 본문(앞 빈 줄 제외)에 같은 규칙을 쓴다. Confluence 팀 페이지는 룰을 frontmatter 없이 싣기 때문에
  룰은 본문 해시로도 이전 배포본을 알아본다.
- 스킬 frontmatter의 metadata.version은 manifest 항목 version과 같다. 내용을 바꾸면 항목 version과 kitVersion을 함께 올린다.
- 검사는 개발 전용 scripts/agent-kit.js와 npm run check가 한다. 2단계에서 설치에 필요한 읽기·해시 규칙을 src/agent-kit/로 옮기고
  검사 스크립트가 그 모듈을 사용하게 한다.

### 명령 — 3단계 구현 (DC-17)

```sh
docatlas agents install [--project] [--root <dir>] [--target claude|codex|all] [--all | --only <name>] [--dry-run] [--force]
docatlas agents help
```

- 기본은 전역·manifest에서 default가 true인 항목이다. DC-28부터 세 항목 모두 default다(이전: designer 한 쌍).
  --all은 default 여부와 관계없이 모든 항목이다. DC-28 뒤에는 기본과 같았고, kit 1.3.0부터는 default false인 doc-driven-private-v1까지 네 쌍이다.
  --project는 --root(기본 cwd) 프로젝트에 설치한다. --only는 반복할 수 있고 --all과 함께 쓸 수 없다.
- --target의 기본값은 설치된 클라이언트 감지다. ~/.claude가 있으면 Claude, ~/.codex나 ~/.agents가 있으면 Codex다.
  아무것도 없으면 --target을 요구한다. 한쪽 폴더만 있는 사용자는 그 클라이언트에만 설치된다.
  DC-28: 감지 기준은 바꾸지 않는다. ~/.agents만 있어도 Codex로 감지하는 점을 알고 유지한다.
- 결과는 탭으로 구분한 줄이다. 파일마다 동작·reason·클라이언트·종류·이름·경로를 쓰고, 이어서 backup·warning·record 줄과
  마지막 summary 줄(create·replace·unchanged·skipped·blocked 개수)을 쓴다. --dry-run은 동작 줄과 summary 줄 앞에 dry-run을 붙이고 쓰지 않는다.
- 대화형 질문을 하지 않는다(RQ-18). skip-*나 blocked가 있으면 나머지를 마치고 사용자 결정이 필요하다고 stderr에 알린다.
- 종료 코드: 0 완료(할 일 없음 포함), 3 완료했지만 사용자 결정이 필요한 항목 있음, 1 실패(이번 실행이 쓴 파일 복구), 2 잘못된 인자.
  기존 문서 지도의 0·1·2 의미는 유지한다. 3은 agents와 private 명령이 쓴다(private의 3은 아래 개인 문서 계약 참고).
- 쓰기 순서: 설치 잠금 → 모든 대상이 판정 이후 바뀌지 않았고 링크가 생기지 않았는지 다시 확인 → --force 대상 백업 →
  임시 파일 후 이름 변경 → 설치 기록 갱신 → 잠금 해제. 백업은 ~/.docatlas/backups/<UTC 시각>/<global|project>/<대상 상대 경로>다.
  실패하면 이번 실행이 쓴 파일과 만든 폴더를 되돌린다.
- 설치 잠금은 <base>/.docatlas/install.lock이다(Test Hardening 추가). 이미 있으면 다른 설치가 진행 중으로 보고 아무것도 바꾸지 않고 종료 1로
  잠금 파일 경로를 알린다. 한 실행의 복구가 다른 실행이 쓴 파일을 지우지 않게 하기 위해서다.
- 교체와 복구 때 기존 파일의 권한 비트를 유지한다(Test Hardening 추가).
- 설치 기록에는 쓴 파일과 이미 같은 내용(unchanged)인 파일을 남긴다. 내용이 같으면 기록 파일을 다시 쓰지 않고,
  기록할 항목이 없으면 새 기록을 만들지 않는다.
- 문서 지도 옵션과 섞지 않는다. agents 외의 위치 인자는 지금처럼 오류다. 제거 명령은 이번 범위에 넣지 않았다.

### 에이전트용 도움말 — 3단계 구현 (RQ-18)

사람보다 에이전트가 설치를 대신 실행하는 경우가 많다. 2026-10-28 사용자가 아래 내용을 확인했다.
docatlas agents help(또는 agents install --help)는 네트워크 없이 다음을 출력한다.

- 하는 일, 설치 위치, 기본 대상과 선택 방법.
- 권장 순서: --dry-run → 결과를 사용자에게 보고 → 사용자 승인 후 적용.
  DC-28: 기본 설치가 세 항목 모두이므로 포함 여부를 먼저 묻지 않는다(DC-26의 질문 단계 대체).
  1단계는 "사용자가 일부만 원하면 항목마다 --only <name>을 붙인다"이다.
  DC-26 후속: 적용 뒤 종료 코드가 3이면 건너뛰거나 막힌 파일과 이유를 사용자가 묻지 않아도 알린다.
  --force는 에이전트가 스스로 붙이지 않고, 사용자가 그 파일을 교체하라고 할 때만 쓴다(교체 전 백업).
- DC-27: 도움말에 "Claude Code·Codex가 아닌 에이전트" 절을 둔다. --target으로 남의 폴더를 만들지 말 것, 원본 경로
  (실행 중인 패키지의 agent-kit 절대 경로 아래 skills/<name>/SKILL.md·agents/<name>.md)와 GitHub 주소, 사용자에게 규칙 위치를 묻고
  옮길 것, 그 사본은 docatlas가 추적·갱신하지 않으니 업데이트 후 다시 할 것을 적는다. agentsHelp는 키트 경로를 두 번째 인자로 받고
  기본값은 KIT_DIRECTORY다. 클라이언트 폴더 없음·알 수 없는 --target 오류 메시지에 이 절을 가리키는 문장을 더한다.
  자동 테스트가 도움말에 이 단계 문구가 있는지 확인한다.
- skip-modified·skip-downgrade·같은 이름 경고의 의미. --force는 사용자가 명시적으로 승인할 때만 쓴다.
- 결과 줄의 형식과 종료 코드.

- kit 버전과 항목별 버전·기본 설치 여부.

docatlas --help에는 agents install과 agents help를 가리키는 두 줄이 있다.
자동 테스트가 도움말 Options의 옵션 목록과 실제 옵션을 양방향으로 대조한다.

### 판정과 보호 — 2단계 판정 구현 (PR-09)

src/agent-kit/plan.js가 파일을 쓰지 않고 대상마다 아래 순서로 판정한다. 쓰기·백업·기록 저장은 install.js(3단계)가 한다.

| 순서 | 상황 | 동작 (reason) |
| --- | --- | --- |
| 1 | 경로가 심볼릭 링크를 지나거나 대상이 일반 파일이 아님 | blocked (symlink·not-directory·not-file). --force로도 쓰지 않는다 |
| 2 | 대상 파일 없음 | create (new) |
| 3 | 정규화 해시가 설치할 내용과 같음 | unchanged (same) |
| 4 | 대상 폴더의 .ctxbin-sync.json items에 이름이 있음 | skip-managed (ctxbin). 한 위치를 두 도구가 관리하지 않게 한다 |
| 5 | 설치 기록의 경로·해시와 같고 기록의 kitVersion이 패키지보다 높음 | skip-downgrade (downgrade) |
| 6 | 설치 기록의 경로·해시와 같음 | replace (recorded) |
| 7 | 이전 배포본의 파일 해시와 같음 | replace (previous-file) |
| 8 | 이전 배포본의 본문 해시와 같음(Codex 룰 제외) | replace (previous-body) |
| 9 | 그 외: 사용자가 고친 사본 | skip-modified (modified) |

- skip-* 항목은 --force일 때 백업 표시와 함께 replace가 된다. 그 밖의 replace는 백업하지 않는다.
- 심볼릭 링크를 지나는 경로에는 쓰지 않는다. 2단계 결정: 전역 설치에서는 클라이언트 폴더 자체(~/.claude 등)가
  디렉터리를 가리키는 링크여도 된다. dotfiles 저장소로 설정 폴더를 관리하는 사용자를 막지 않기 위해서다. 프로젝트 설치에는 이 예외가 없다.
- 설치 기록(schema 1)은 files의 "client/kind/name" 키마다 path·kitVersion·version·sha256을 둔다. 읽기 실패나 형식 오류는 경고 후 무시한다.
  위치는 전역 ~/.docatlas/agents.json, 프로젝트 <root>/.docatlas/agents.json(함께 커밋)이다. 백업은 ~/.docatlas/backups/다.
  수집기는 이미 .docatlas/를 기본 제외한다.
- 반대쪽 범위(전역↔cwd 프로젝트)에 같은 경로가 있으면 같은 이름 경고와 함께 클라이언트 규칙 표의 동작을 알린다.
- 프로젝트 설치에 Codex 룰이 들어가면 codex-trust 경고로 신뢰한 프로젝트에서만 읽힌다고 알린다(Integration Test 추가).
- 쓰기 순서와 복구는 위 명령 계약을 따른다.

### 업데이트 안내 — 4단계 구현 (PR-10)

- 문서 지도 시작 시 패키지 manifest의 kitVersion과 전역·문서 지도 루트(기본 cwd, --root)의 설치 기록만 읽는다.
  기록 항목 중 패키지보다 낮은 kitVersion이 있으면 문서 수 안내 뒤에 한 줄을 출력한다.
  kit 1.3.0(RQ-22 4단계)부터는 그 기록의 항목 version도 manifest 항목보다 낮아야 한다. 새 항목만 더한 kit은 설치된 항목의
  갱신이 아니므로 안내하지 않는다. 기록에 항목 version이 없거나 형식이 틀리면 전처럼 kitVersion만 본다.
  예: Agent skills: kit 1.1.0 is available (installed 1.0.0). Preview the update with: docatlas agents install --dry-run
- 미리보기 명령은 범위마다 만든다. 프로젝트 기록이면 --project를 붙이고, 낡은 항목에 기본 대상이 아닌 것이 있으면
  --only로 낡은 항목을 모두 지정해 같은 항목이 갱신되게 한다. kit에 없는 이름은 무시한다.
- 설치 기록이 없으면 안내하지 않는다. Confluence에서 손으로 복사한 사본에는 안내가 뜨지 않으므로, 팀이 준비될 때 설치 명령을 쓰기 시작하면 된다(4단계 결정).
- 파일을 쓰지 않는다. 서버 준비를 기다리게 하지 않고 비동기로 확인하며 읽기 실패는 무시한다. 종료를 시작한 뒤에는 출력하지 않는다.

## Phase 5 검증 계약

- 기존 Node 81개·Chrome 30개를 회귀 기준으로 유지한다.
- 감지기의 초기 준비·교체·오류·종료가 겹치는 상황과 SSE 연결이 열린 상태의 신호 종료를 검증한다.
  종료한 실행에서 새로운 갱신을 발행하지 않고 감지기·타이머·연결을 남기지 않는다.
- 제외 규칙 변경·읽기 실패·심볼릭 링크·인코딩 경로와 동명/긴 한글 문서·큰 표를 검증한다.
  수집/설정/ignore/이미지는 검사한 파일 descriptor로 읽는다. open 전후의 파일 동일성과 루트 경계를
  확인하고 파일/부모가 링크로 바뀌면 해당 읽기를 거부한다.
- 매 수집에서 원본 파일과 정책을 다시 읽는다. 이전 세대와 내용 해시가 같은 문서만 AST 메타데이터를
  재사용한다. mtime/size만으로 판단하지 않으며 제외/삭제 문서의 캐시는 새 세대에 남기지 않는다.
- F-08은 75개 기능의 4종 문서 300개, 본문 최소 16KiB, 여러 깊이, 비문서 파일 1,000개로 구성한다.
  준비 시간은 수집 시간과 분리한다. 반복 표본·환경·본문 바이트 수·수집/검색/저장 반영과
  유휴 CPU·RSS/heap을 기록한다. 자동 테스트의 제한 시간과 성능 회귀 기준을 구분한다.
- 측정 후 정하는 수치는 이 가상 예제와 기록한 환경의 회귀 기준이다. 모든 프로젝트의 성능 보장이 아니다.
- Phase 5 검증을 마쳤다. F-08의 측정 결과·표본과 채택한 로컬 회귀 기준은
  [구현 계획의 검증 기록](./IMPLEMENT.md#phase-5-완료-검증--2026-10-28)을 기준으로 삼는다.
  같은 본문의 재사용은 저장 반영 중앙값을 907.88ms에서 599.30ms로 줄였다. 장시간 메모리 상한을 보장하지 않는다.

## Phase 6 통합 검증 계약

- npm run test:integration은 실제 npm pack 결과를 별도 임시 디렉터리에 production 의존성만 설치한다.
  설치된 CLI·공개 수집 API·HTTP·Chrome으로 검증하며 소스의 서버 모듈을 직접 실행하지 않는다.
- 프로젝트별 설치 검증은 F-07 JS 대상에도 tarball을 개발 의존성으로 설치한다. 설치된 .bin/docatlas와
  호환 .bin/docmap·.bin/ddd-docmap, npm exec와 npm run docatlas의 명령 발견을 확인한다.
- F-07의 JS/비 JS 프로젝트에서 cwd·--root·루트 별칭, 4종 선택·서식·참조·검색·갱신·신호 종료를 확인한다.
  두 실행 중 하나를 종료해도 다른 실행의 내용과 상태가 유지되어야 한다.
- 실행 전후 파일 목록과 내용 해시를 비교한다. 검증 중 명시적으로 저장한 내용 외의 변경은 실패다.
  설치 단계의 명시적 manifest/lockfile/node_modules 변경 이후를 기준으로 원본을 비교한다.
  프로젝트의 빌드나 설치 스크립트는 실행하지 않는다.
- DOCMAP_NPM_CACHE로 설치 캐시를 지정할 수 있으며 오프라인 설치를 기본으로 한다.
  Chrome은 기존 DOCMAP_BROWSER_CHANNEL 설정을 따른다. 최종 지원 OS·최소 Node·사람의 수동 인수는 별도 기록한다.

## 배포와 구현 선택

2026-10-28 사용자 선택: npm 패키지는 unscoped docatlas, 공개 GitHub 저장소는
superlucky84/docatlas, 라이선스는 MIT다. 0.2.0은 사용자가 배포했고 다음 공개 후보는 사용자 요청으로 0.3.0이다.
name/version/license/bin과 lockfile 루트를 함께 바꾸며 self import는 docatlas로 갱신한다.
0.1.0의 ddd-docmap.config.json은 0.2.0에서 fallback으로 유지하며 기본 파일명은 docatlas.config.json이다.
기존 내부 상태 키는 호환성을 위해 유지한다.

npm files는 bin/·src/로 제한하고 README·package.json·LICENSE의 자동 포함을 확인한다.
RQ-17 3단계에서 agent-kit/를 files에 추가했다. 스킬·룰 원본 6개와 manifest·README가 패키지에 들어간다.
기준 문서·AGENTS·METHOD·CONTRIBUTING·CHANGELOG·인계 이력은 GitHub에서 제공한다. README의 문서 링크는 GitHub의 새 저장소를 가리킨다.
Phase 5 보존 패치는 적용이 끝나 2026-10-28에 docs/handoff/에서 삭제했다. 원본은 git 이력(00064c2)에 있다.
검증한 tarball을 별도 설치해 실제 docatlas 실행·공개 import·화면·신호 종료를 확인한다.
README의 기본 사용 명령은 docatlas다. 프로젝트 루트에서의 npx 일회성 실행과 npm/pnpm 로컬 설치,
다음 버전의 tarball을 설치하는 방법을 별도 항목으로 설명한다.
0.2.1은 준비 버전으로 남기고 Python·Java 기본 제외와 에이전트 스킬 설치를 0.3.0으로 함께 배포한다.
2026-10-28 요청 범위는 병합된 main 전환·버전 변경·검증과 배포 절차 안내다. 실제 npm publish는 실행하지 않는다.
패키지 버전과 agent-kit/manifest.json의 kit·항목 버전은 독립적이다. 스킬·룰 원본이 같으므로 kit 버전·해시는 유지한다.
0.3.1(2026-10-28 사용자 결정): .conda 기본 제외, CLI 도움말의 설정 가이드 링크, 에이전트용 도움말 보강을 담는 패치 배포다.
kit 1.0.0과 스킬·룰 해시는 그대로이므로 설치된 스킬의 업데이트 안내는 나오지 않는다. CHANGELOG의 Unreleased를 0.3.1로 옮긴다.
0.4.0(2026-10-29 사용자 결정): agents install의 기본 대상을 세 쌍으로 바꾸는(DC-28) 마이너 배포다. kit 1.0.0과 해시가 그대로이므로
문서 지도의 업데이트 안내는 나오지 않는다. designer만 설치한 사용자는 같은 명령을 다시 실행할 때 두 항목이 추가된다.
CHANGELOG의 Unreleased를 0.4.0으로 옮긴다.
0.4.1(2026-10-30 사용자 결정): designer 1.2.0과 kit 1.1.0을 담는(DC-29) 패치 배포다. CLI 동작은 바뀌지 않는다.
첫 kit 내용 변경이라 docatlas로 설치한 사용자는 문서 지도 시작 시 업데이트 안내 한 줄을 보고,
같은 설치 명령을 다시 실행하면 designer 스킬만 바뀌고 나머지는 unchanged로 기록이 갱신되어 안내가 사라진다.
설치 기록이 없는 손 복사본에는 안내가 없고, 손으로 고친 사본은 skip-modified로 남는다. CHANGELOG의 Unreleased를 0.4.1로 옮긴다.
0.4.2(2026-11-01 사용자 결정): kit 1.2.0(designer 1.3.0·implementer 1.2.0·reviewer 1.5.0)을 담는(RQ-20·DC-30) 패치 배포다. CLI 동작은 바뀌지 않는다.
0.4.2부터 게시는 `v` 태그 푸시로 GitHub Actions가 한다(RQ-21·DC-31).
docatlas로 설치한 사용자는 문서 지도 시작 시 업데이트 안내 한 줄을 보고, 같은 설치 명령을 다시 실행하면 세 스킬·룰이 바뀌고 안내가 사라진다.
설치 기록이 없는 Codex 사본도 0.3.0~0.4.1 변환본이면 이전 버전으로 인식해 교체한다. CHANGELOG의 Unreleased를 0.4.2로 옮긴다.
0.5.0(2026-11-01 사용자 결정): 개인 문서와 백업(RQ-22·23, DC-32~36)과 kit 1.3.0(doc-driven-private-v1 1.0.0 추가, implementer 1.3.0)을 담는 마이너 배포다.
기존 명령·설정·수집 규칙은 그대로다. docatlas로 설치한 사용자는 implementer만 낮아 업데이트 안내를 한 번 보고(PR-10 보완: 새 항목만 더한 변경은 안내하지 않음),
`--all`은 private까지 네 쌍을 설치한다. 게시는 `v0.5.0` 태그 푸시로 GitHub Actions가 한다. CHANGELOG의 Unreleased를 0.5.0으로 옮긴다.
0.6.0(2026-11-03 배포 요청): 선택 백업 역할과 private-cloud 보조 명령(RQ-24~29), kit 1.4.0을 담는 마이너 버전이다.
기존 네 쌍의 버전/해시·기본 세 쌍·로컬 phase 백업을 유지하고 --all은 다섯 쌍과 새 Codex 정책을 포함한다.
main의 macOS/Windows × Node 22/24 검사 통과 후 v0.6.0을 푸시해 npm Trusted Publishing을 실행한다. 이미 게시한 태그는 이동하지 않는다.
실행 결과: run 41591966422 네 조합 통과, v0.6.0은 26e30de, Publish to npm run 41592640829 성공. npm latest/gitHead/provenance와 게시본 실행·GitHub 릴리스를 확인했다.
0.7.0(2026-11-04): RQ-30·31 파일 기록 탐색/검색과 RQ-32 최소화 UI를 담는다. fd12146의 플랫폼 CI 41786014563 네 조합 통과 후
v0.7.0을 푸시했고 게시 run 41786794590 성공. npm latest 0.7.0·gitHead fd12146·SLSA provenance와 빈 캐시 npx 실행을 확인했다.
배포물은 61파일·압축 100,532·해제 343,111바이트다. GitHub 릴리스 생성과 최종 UX 인수는 이번 게시와 구분한다.
추가 요청으로 기존 v0.7.0 태그에 `docatlas 0.7.0` 영문 릴리스를 정식 Latest로 게시했다.
변경점·업그레이드 안내·검증 근거는 CHANGELOG와 실제 게시 결과를 따르며 태그와 npm 배포물은 유지한다.


배포 패키지에 CLI·수집기·서버·빌드된 화면을 함께 포함한다.
설치 대상 프로젝트에서 화면 빌드를 실행하지 않게 한다.

기술 후보를 평가할 때 유지보수성, Node 최소 버전, 패키지 크기, Markdown 기능,
실제 파일 갱신과 테스트 용이성을 기록한다. 수집기 의존성은 IC-01을 따르며
화면은 기본 DOM·ES modules·CSS이며 별도 번들링 없이 완성된 자산을 패키지에 포함한다.
렌더링은 markdown-it, 변경 감지는 chokidar 5.0.0을 사용한다.

## 저장소 소개 문서 — RQ-19 계약

2026-10-28 사용자 결정(DC-20)에 따른 문서 구성이다. 제품 코드·설치 동작·스킬과 룰 원본은 바꾸지 않는다.
예외: DC-29는 METHOD와 함께 designer 스킬 원본을 바꾼다.

| 파일 | 내용 | npm 패키지 |
| --- | --- | --- |
| README.md | 핵심만: 소개·DDD 요약·구성·빠른 시작·역할·문서 지도 기본·Configuration 안내·더 읽기 목록(DC-25) | 자동 포함 |
| guide/document-map.md · guide/configuration.md · guide/platforms.md | README에서 옮긴 사용 레퍼런스(DC-25) | 제외 |
| METHOD.md | 방법론 전문(영문): 정의·원칙·4종 문서·흐름·작성 규칙·역할·문서 배치·도구와의 관계 | 제외 |
| CONTRIBUTING.md | 개발 설치·검사·브라우저/설치 통합·플랫폼·벤치마크·소스 tarball·문서 작업 방식 | 제외 |
| CHANGELOG.md | 게시한 버전별 변경 요약 | 제외(npm 10.9.4 pack에서 자동 포함 안 됨 확인) |
| agent-kit/README.md | 킷 구성·설치 명령·현재 버전·변경 절차 | 포함 |
| METHOD.ko.md | METHOD.md의 한국어 번역(DC-21) | 제외 |
| examples/sample-shop/ | 영문 합성 예제 프로젝트(DC-21) | 제외 |
| docatlas.config.json | 이 저장소 문서 지도의 include를 docs/**/*.md로 한정(DC-21) | 제외 |

README 순서(DC-25, 목표 150줄 안팎):

1. 제목과 한 줄 소개, DDD가 Domain-Driven Design이 아니라는 안내, 캡처.
2. Doc-Driven Development 요약: 핵심 문장, 4종 문서, 핵심 규칙 3개, 필요한 만큼 쓰라는 한 줄,
   스펙 주도 개발 질문에 대한 짧은 답, METHOD 링크.
3. 이 저장소의 구성 표, 빠른 시작, 에이전트 역할 표.
4. 문서 지도 기본: 사람용 지도인 이유 한 문단, 실행 명령, 옵션 표, 지원 OS 한 줄과 가이드 링크.
5. Configuration: 설정 없이 동작한다는 안내와 가이드 링크. 0.3.0 도움말이 가리키는 앵커라 제목을 유지한다.
6. 더 읽기 목록: METHOD·가이드 세 개·agent-kit·예제·이 저장소 기획 문서·CONTRIBUTING·CHANGELOG.
7. 라이선스.

상세 위치(DC-25): 문서 지도 실행·설치·화면·읽기·검색·Collector API는 guide/document-map.md,
문서 위치·제외·설정 파일은 guide/configuration.md, Windows·Linux·WSL은 guide/platforms.md,
에이전트 설치 위치·갱신·출력은 agent-kit/README.md(npm 패키지 포함)로 옮긴다. 같은 설명을 두 곳에 쓰지 않는다.
guide/는 이 저장소 기획 문서(docs/)와 구분하며, 저장소 지도(docs/만 수집)에는 넣지 않는다.

규칙:

- 0.3.0의 src/cli.js 도움말이 README#configuration을 가리키므로 README에 Configuration 제목과 가이드 링크를 유지한다.
  다음 배포부터 도움말은 guide/configuration.md를 가리킨다(DC-25, PR #3).
- npm 패키지에 없는 파일(METHOD·CONTRIBUTING·CHANGELOG·docs·캡처)은 GitHub 절대 URL로,
  패키지에 있는 LICENSE·agent-kit/는 상대 경로로 연결한다. 기존 README 링크 규칙과 같다.
- METHOD.md와 README 요약은 agent-kit 세 스킬·룰의 규칙을 요약한다. 새 규칙을 만들지 않는다.
  스킬·룰을 바꾸면 METHOD.md와 README 요약이 여전히 맞는지 확인한다. 이 단계를 agent-kit/README.md 변경 절차에 넣는다.
- 공개 안내는 Confluence·ctxbin을 원본과 사본의 관계로 설명하지 않는다. ctxbin 관리 파일 건너뛰기는 설치 동작 설명에만 남긴다.
- 문서 지도 캡처는 저장소에 넣을 수 있는 합성 영문 예제로 만들어 .github/assets/document-map.png에 둔다.
  개발 스크립트 scripts/screenshot.js가 예제 복사·서버 실행·브라우저 캡처를 재현한다. 제품 코드와 npm 패키지에는 포함하지 않는다.
- DC-21: METHOD.ko.md는 METHOD.md의 번역이며 영어판이 기준이다. 두 문서는 같은 변경에서 함께 고친다.
- Clone 실행 안내(2026-10-29 사용자 확인): README·METHOD 두 언어판·예제 README에서 저장소 루트의 npm install을
  npx docatlas 실행보다 먼저 안내한다. 로컬 소스 의존성을 준비하는 문서 보정이며, npm 배포 없이 커밋한다. 검증: M-18.
- DC-21: examples/sample-shop/은 사용자 안내용 영문 합성 예제다. checkout은 4종 전체로 상태 표시·결정·phase·인계를 보여 주고,
  다른 기능은 부분 문서·중첩 기능·공유 계약·코드 옆 docs/를 보여 준다. 실제 회사 문서를 쓰지 않는다.
  테스트 fixture가 아니며, 기존 테스트는 계속 임시 디렉터리에 예제를 만든다. README 캡처는 이 예제를 복사해 만든다.
- DC-21: 저장소 루트의 docatlas.config.json은 {"version":1,"include":["docs/**/*.md"]}이다. 기본 제외 목록을 반복하지 않고
  이 저장소의 지도에서 예제를 뺀다. 예제는 --root examples/sample-shop으로 연다.
- DC-21: test/examples.test.js가 예제의 수집 결과와 저장소 지도의 예제 제외를 확인한다.
- DC-22: METHOD.md·METHOD.ko.md에 프로젝트 적용 절을 둔다. 적용 범위는 세 단계 선택지다.
  필요할 때만 스킬 사용(프로젝트 설정 없음) → AGENTS.md·CLAUDE.md에서 있는 문서를 따르도록 안내 → 이 저장소 AGENTS.md 같은 전체 규칙.
  권장 예시는 두 번째 단계이며 문서가 없는 작은 수정에는 새 문서를 요구하지 않는다. 그대로 쓰지 않고 고쳐 써도 된다고 밝힌다.
  설치 명령은 계속 AGENTS.md·CLAUDE.md를 수정하지 않는다. README 핵심 규칙 아래에도 필요한 만큼 쓰라는 한 줄을 둔다.
  examples/sample-shop/AGENTS.md는 같은 가벼운 예시다. 루트 파일이라 기본 수집 대상이 아니며 예제 문서 수(21개)는 그대로다.
- DC-22: METHOD 두 언어에 문서 관리 절을 둔다. 정리는 에이전트가 하되 사람이 문서의 분포와 내용을 알아야 정리를 시킬 수
  있다는 점과, 그래서 docatlas가 사람이 보는 읽기 전용 뷰어라는 점을 설명한다. README 요약도 같은 이유로 문서 지도를 소개한다.
- DC-23: METHOD의 spec 우선 도구 비교 절을 "스펙 주도 개발과의 관계" 절로 바꾼다. 공통점(코드 전에 쓰고, 요구사항·설계는
  사실상 스펙)과 차이(중심이 스펙이 아니라 문서 전체와 그 관리, 사람이 문서의 분포와 내용을 파악해 에이전트를 지휘)를 쓴다.
  다른 도구는 공개적으로 알려진 흐름(스펙 → 계획 → 작업 → 코드)만 언급하고 단점을 단정하지 않는다. README에도 짧은 문단과 링크를 둔다.
  보강: 하위 절 두 개를 둔다. "같은 순간, 두 관점"은 예제 checkout의 Phase 3 중단 시점(DC-3 TBD)으로 스펙만 있을 때와
  문서 세트가 있을 때를 비교한다. "어디에서 왔나"는 스펙 우선 작성, ADR(Nygard 2011), README 주도 개발(Preston-Werner 2010)을
  이어받았고 새로운 점은 AI 에이전트용 조합과 중심의 선택이라고 밝힌다. 외부 링크는 확인한 주소만 쓴다.
- DC-29: METHOD 두 언어의 문서 위치 절을 보강한다. 첫 문장에 테스트가 모듈 옆에 있듯 문서를 코드 옆에 두는 이유를 붙이고,
  2번 항목에 코드가 보여 주는 묶음(목적·기능·책임)을 따르며 모듈마다 docs/를 두지 않고 여러 모듈에 걸친 기능은 위치 하나에 둔다는 규칙을 더한다.
  목록 뒤에 디렉터리 이름만으로 기능 경계가 보이지 않으면 에이전트가 위치를 제안하고 프로젝트를 아는 사람이 정한다는 문단을 둔다.
  1·3번 항목과 예시 트리는 그대로다. README 요약("Documents live beside the code…")은 그대로 맞으므로 바꾸지 않는다.
  designer 스킬의 Documentation Discovery and Placement에 같은 두 규칙을 둔다. 둘째 규칙은 새 문서를 만들기 전에 위치를 제안하고
  사용자에게 묻는 동작이다. 서브에이전트로 실행되면 제안한 위치에 초안을 두고 위치를 TBD로 표시해 질문을 돌려준다(기존 서브에이전트 규칙과 같다).
  스킬 1.1.0→1.2.0, kitVersion 1.0.0→1.1.0. 에이전트 룰과 implementer·reviewer는 바꾸지 않는다.
- README 지원 환경 표: Linux는 자동 검증 결과(환경·날짜·테스트 수)를 적고 지원 확정으로 표현하지 않는다(DC-10 TBD).
  WSL은 직접 검증하지 않았음을 밝히고 코드 동작에서 나온 안내(WSL 안의 Node 22+, 출력된 127.0.0.1 주소 그대로 사용,
  WSL 파일 시스템 권장, 설치 위치)를 둔다. 프로젝트 안 conda 환경은 0.3.0 기본 제외가 아니므로 .gitignore나 exclude를 안내한다.
- 이전 README의 사용법 정보는 지우지 않고 새 위치로 옮긴다. 버전별 신규 표시는 CHANGELOG.md로 옮긴다.
- package.json은 description과 keywords만 바꾼다. 이름·버전·bin·files·의존성은 그대로다.

## 구현 계획의 Refs·Files 표기 — RQ-20 계약

2026-11-01 사용자 결정: 구현 계획의 단계마다 Refs(다루는 ID)와 Files(실제로 바꾼 파일)를 둘 다 남긴다.
같은 날 사용자가 DC-30의 세 TBD를 제안대로 정해 아래 형식을 확정했다. METHOD 두 언어판과 kit 1.2.0에 반영했다(배포 전).

목적: 사람이 읽는 단계 기록을 그대로 두면서, 줄 단위 규칙만으로 "단계 → ID → 파일"을 뽑아낼 수 있게 한다.
뽑아낸 결과로 파일별 변경 이력, 요구사항별 관련 파일 같은 검색과 2차 문서를 만든다.

### 형식

```markdown
## Phase 2 — Guest session: done

Refs: RQ-1, DC-1, M-1

- [x] Issue a signed guest session cookie.

Files:
- `services/checkout/session.js` (added)
- `services/checkout/orders.js` (modified)
- `services/checkout/legacy-cart.js` -> `services/checkout/cart.js` (renamed)
- `docs/checkout/IMPLEMENT.md` (modified)
```

### 규칙

- 소속: Refs와 Files는 바로 위의 가장 가까운 제목(단계나 작업 절)에 속한다. 하위 제목은 상위 제목의 Refs를 물려받는다.
  단계 하나에 Refs 줄과 Files 블록은 하나씩이다. 이 저장소처럼 작업 절 아래 구현·Test Hardening·Integration Test 하위 절이
  있으면 Refs는 작업 절에 한 번, Files는 파일을 바꾼 하위 절마다 둔다.
- Refs: 단계 제목 바로 아래 문단의 한 줄로 쓴다. `Refs: ` 뒤에 전체 ID를 `, `로 구분한다. ID는 대문자 접두사-번호 형식이며
  프로젝트의 기존 접두사(RQ·DC·IC·PR·M 등)를 따른다. 접두사나 번호를 줄여 쓰지 않는다(`RQ-01·03` 대신 `RQ-01, RQ-03`).
  해당하는 ID가 없으면 `Refs: none`.
- Files: 단계의 체크리스트·검증 기록 뒤, 다음 제목 전에 둔다. `Files:`만 있는 줄 바로 다음 줄부터 목록 항목을 쓴다.
  항목은 `` - `<path>` (<kind>) ``이고 kind는 added·modified·deleted·renamed 중 하나다.
  이름 변경은 `` - `<old>` -> `<new>` (renamed) ``이며, 내용도 바뀌었으면 renamed 항목 하나로 적는다.
  설명은 항목에 붙이지 않고 체크리스트에 쓴다. 바꾼 파일이 없으면(검증만 한 단계) `Files: none`.
- 경로: 문서 위치와 상관없이 저장소 루트 기준이며 `/`로 구분하고 백틱으로 감싼다. 문서가 코드 옆 여러 곳에 흩어지므로
  문서 기준 상대 경로는 쓰지 않는다. 생성된 파일이 한 폴더에 많으면 `/`로 끝나는 폴더 항목 하나로 적을 수 있다.
- 내용: 그 단계에서 실제로 바뀐 파일만 적는다. 기준 문서·README 같은 문서도 포함한다. 예정한 파일은 Files에 적지 않는다
  (확인된 요청·설계 제안·구현된 동작 구분). 같은 파일을 여러 단계가 바꾸면 단계마다 적는다. 단계를 다시 열면 블록을 고쳐 쓴다.
- 출처: 기억이 아니라 git에서 만든다. `git status --porcelain -uall`(새 폴더 안의 파일까지 파일 단위로 본다)과 `git diff --name-status`를 쓴다.
  단계 구현을 시작할 때 변경 목록을 적어 두고, 끝에서 그 목록의 파일은 이 단계가 다시 바꾸지 않았다면 뺀다. designer 스킬만으로도 이 규칙을 따른다.
  designer 룰은 요약이라 이 단서를 두지 않는다(서브에이전트 designer는 구현하지 않고 문서 초안만 쓴다).
- 알려진 한계(TBD): 단계 도중에 커밋하면 그 파일이 작업 트리 목록에서 사라진다. 시작 HEAD를 적어 `git diff --name-status <HEAD>`로
  보완할 수 있지만 스킬 분량을 늘리지 않으려고 이번에는 넣지 않았다(2026-11-01 리뷰 suggestion). 단계 하나가 여러 세션에 걸치면
  시작 때 적은 목록이 새 세션에 남지 않는다. 그때는 앞 단계의 Files 블록에서 앞 단계 파일을 다시 알 수 있다.
- 언어(DC-30 a): `Refs:`·`Files:`·kind·`none`은 문서 언어와 상관없이 영어로 쓴다. 나머지 본문은 프로젝트 언어를 따른다.
- 성격(2026-11-01 사용자 결정): Refs·Files는 검색을 돕는 참고 기록이며 전체 색인이 아니다. 예전 단계와 이 규칙 없이 한 작업에는 기록이 없고,
  Files는 그 단계가 바꾼 파일만 담는다. 파일이나 ID와 관련된 문서를 찾을 때는 기록을 단서로 쓰되 문서 본문(경로·파일 이름·모듈 이름)도
  함께 검색하고, 기록이 없다는 이유로 관련 없다고 판단하지 않는다. 이 성격을 designer 스킬·룰, METHOD 두 언어판의 Phase 기록 절과
  AGENTS.md 예시, 예제 AGENTS.md, 이 저장소 AGENTS.md에 알린다. 스킬 없이 문서 검색을 부탁받은 에이전트도 AGENTS.md에서 읽게 하기 위해서다.

### 파싱 계약

후속 도구가 의존할 수 있는 최소 규칙이다. Markdown 전체 해석 없이 줄 단위로 읽는다.

- 코드 펜스 안의 줄은 무시한다. METHOD·설계 문서의 형식 예시가 실제 기록으로 잡히지 않게 하기 위해서다.
  펜스는 줄 처음의 ``` 또는 ~~~로 열고 닫는다. 들여쓴 펜스와 펜스 길이 구분은 수집 기능(DC-30 c)에서 정한다.
- Refs 줄: `^Refs: (none|ID(, ID)*)$`, ID는 `[A-Z][A-Z0-9]*-[0-9]+`.
- Files 블록: `^Files: none$`, 또는 `^Files:$` 줄 다음에 이어지는 `` ^- `[^`]+`( -> `[^`]+`)? \((added|modified|deleted|renamed)\)$ `` 줄들.
  형식에 맞지 않는 첫 줄에서 블록이 끝난다.
- 소속 제목은 그 줄 앞의 가장 가까운 ATX 제목(`#`~`######`)이며, Refs는 상위 제목에서 물려받는다.
- 형식에 맞지 않는 줄은 오류로 멈추지 않고 건너뛰며, 검사 도구가 따로 보고할 수 있다.

### 역할

2026-11-01 사용자 결정: 보통 designer만 쓴다. designer 스킬·룰만으로 Refs와 Files가 모두 동작해야 하고,
implementer·reviewer는 있을 때 같은 규칙을 강화한다. 둘이 없어도 기능이 빠지지 않는다.
designer 스킬은 이미 구현 중 단계 완료(Phase Completion)와 인계 규칙을 담고 있으므로, 단계를 마칠 때의 Files 작성도 거기에 둔다.
implementer는 다른 스킬이 설치됐다고 가정하지 않고 형식을 한 줄로 다시 적는다. reviewer는 문서에 있는 블록을 git 변경과 비교하므로 형식 전체를 다시 적지 않는다.
스킬·룰에는 에이전트가 따라야 할 동작만 두고, 하위 제목의 Refs 상속·폴더 항목·파싱 계약 같은 세부는 METHOD와 이 계약에 둔다(2026-11-01 사용자 우려에 따른 분량 정리).

| 역할 | Refs | Files |
| --- | --- | --- |
| designer (기본, 단독으로 완결) | 형식을 정의하고 단계를 만들 때 쓴다. | 단계를 만들 때는 쓰지 않는다(예정한 파일은 체크리스트 문장으로). 구현한 단계의 시작 때 변경 목록을 적어 두고, 마칠 때 그 단계를 구현한 에이전트가 git에서 만들어 쓴다. |
| implementer (강화) | 단계를 마칠 때 실제 범위와 맞는지 확인하고 고친다. | designer와 같은 규칙(시작 때 변경 목록, 끝에서 git)을 문서 동기화 단계에 넣고, 완료 보고에 Files를 담는다. 서브에이전트이고 구현 계획이 범위 밖이면 블록을 보고로 돌려준다. |
| reviewer (강화) | ID가 기준 문서에 있는지 확인한다. | 수집한 변경 목록과 비교한다. 빠지거나 남는 항목, 완료 단계의 블록 누락은 doc sync warning이다. 문서가 이 기록을 쓸 때만 확인해, 기록을 쓰지 않는 기존 프로젝트에 경고를 내지 않는다. 읽기 전용이므로 고치지 않는다. |

### 바뀌는 파일과 버전

- METHOD.md·METHOD.ko.md: 작성 규칙에 Refs·Files 항목과 짧은 예시를 더한다. 문서 세트 표의 IMPLEMENT.md 설명도 확인한다.
- designer 스킬: Standard Artifact Flow의 IMPLEMENT.md 항목에서 새 Phase Records 절(형식·출처·작성 시점·ID를 줄여 쓰지 않는 규칙·영어 라벨·
  기존 단계는 요청 없이 소급하지 않음)을 가리키고, Phase Completion에 단계를 마칠 때 Files를 쓰는 규칙, Completion Criteria에 새 단계의 Refs(기존 진입·기준 테스트·종료 기준은 모든 단계 그대로). designer 룰에는 요약(Refs, Files 형식, 참고 기록)을 둔다.
- agent-kit 세 스킬과 세 룰: 위 역할 표의 규칙. designer 1.2.0→1.3.0, implementer 1.1.0→1.2.0, reviewer 1.4.0→1.5.0, kitVersion 1.1.0→1.2.0.
  manifest의 이전 해시 이동·새 해시 기록, agent-kit/README.md 표, CHANGELOG Unreleased. 룰 머리말은 name·description만 둔다.
- README 요약의 문서 표와 규칙이 여전히 맞는지 확인한다. 맞으면 바꾸지 않는다.
- 예제(DC-30 b): examples/sample-shop/docs/checkout/IMPLEMENT.md의 단계에 Refs와 Files를 넣어 형식을 보여 준다. 문서 수는 그대로다.
- 버전을 고정한 테스트(agent-kit-plan.test.js의 kitVersion, agent-kit-install.test.js의 도움말 버전)는 의도된 고정이므로 기대값만 고친다.
- manifest previous에 세 룰의 이전 Codex 변환본 해시(codex-agent, docatlas 0.3.0~0.4.1)도 둔다. 설치 기록이 없는 Codex 사본도
  수정본(skip-modified)이 아니라 이전 버전으로 인식해 교체한다(2026-11-01 리뷰 suggestion).
- 패키지 버전은 0.4.2다(2026-11-01 사용자 결정). 스킬만 바뀐 0.4.1의 전례를 따른 패치 버전이다.

### 이 저장소에 적용

- RQ-20 작업 절부터 Refs·Files를 쓴다. 기존 절의 "대응:" 줄과 문장 속 파일 언급은 그대로 둔다(DC-30 b).
- RQ-20 당시에는 수집기·서버·화면·설치 동작을 바꾸지 않았다(DC-30 c).
  2026-11-04 별도 RQ-30·31로 수집·표시·파일명 검색의 프로토타입을 시작했다. 원본 읽기와 본문 검색은 유지한다.

## 관련 파일과 파일명 검색 — RQ-30·31 프로토타입 계약

2026-11-04 사용자는 문서 주도 절차보다 먼저 사용할 수 있는 프로토타입을 요청했고, 파일명 검색과 용량 확인 뒤 기준 문서 작성을 요청했다.
아래는 그 프로토타입의 구현 사실이다. UI 최종 인수는 DC-46, Lithent 도입 검토는 DC-49의 TBD이며 구현 사실과 구분한다.

### 기록 추출과 경로 — DC-45

- `src/collector/phase-records.js`가 문서별 단계 기록을 추출하고 `scan.js`의 내용 해시 기반 metadataCache에 보관한다.
  공개 `collectProject()` 스냅샷과 `/api/map`에 전체 기록/본문을 싣지 않는다. CLI·서버·화면과 독립된 수집 모듈이다.
- 기존 RQ-20의 영어 Refs/Files/none·ID·목록 문법을 사용한다. Refs는 제목 스택의 가장 가까운 명시 값을 상속하며
  `Refs: none`은 빈 값으로 상속을 끊는다. 완료 여부를 제목 문구로 추론하지 않고 실제 Files 기록을 읽는다.
- BOM·선두 front matter를 제거한 뒤 기존 의존성 MarkdownIt의 `html:false` 토큰으로 제목과 코드 범위를 구분한다.
  fenced/indented code의 예시를 제외한다. 펜스 길이·들여쓰기와 ATX/setext 제목은 같은 Markdown 토큰 규칙을 따른다.
  github-slugger와 렌더러의 제목 텍스트 규칙을 맞춰 한글·중복 제목을 포함한 기록 단계 앵커를 만든다.
- Files 항목 형식이 아닌 첫 줄에서 블록을 끝낸다. 형식은 맞아도 경로가 안전하지 않거나 renamed의 이전/이후 경로가
  맞지 않는 항목은 건너뛴다. 문서 하나의 비정상 기록 때문에 수집 전체를 중단하지 않는다. 별도 형식 진단 UI는 없다.
- 경로는 기록된 저장소 루트 기준 문자열이다. 절대/드라이브 경로, 역슬래시·제어문자, `.`/`..` 구간, 중복 `/`를 거부한다.
  끝 `/`인 폴더 기록을 보존하고 실제 하위 파일로 전개하지 않는다. deleted와 renamed도 과거 기록으로 남긴다.
- 실행 루트가 저장소 하위 폴더일 때 Git 루트를 조회하거나 경로를 재기준화하지 않는다. 문서 열기 대상은 현재 인덱스의
  문서 id와 기록 경로가 일치할 때만 제공한다. 소스 파일의 존재 확인·내용 읽기·전송은 하지 않는다.

### 문서 연결과 API — DC-45

`src/collector/related-files.js`를 문서 API와 검색 인덱스가 함께 사용한다.

1. 선택 문서에 Files 기록이 하나라도 있으면 그 문서 기록만 사용한다. `Files: none`만 있는 문서도 여기에 해당한다.
2. 기록이 없으면 같은 `groupId`의 canonicalId 없는 implementation 문서들을 사용한다.
3. 부모·자식·다른 기능·공개/개인 그룹으로 기록을 전파하지 않고, 같은 RQ/DC/M 번호만으로 문서를 결합하지 않는다.
4. 현재 경로로 중복을 합치되 모든 단계별 출처를 보존한다. renamed는 새 경로의 한 항목에 oldPath를 남긴다.

`/api/document`의 기존 응답에 `relatedFiles`를 더한다. 기존 sequence/revision과 같은 generation에서 계산한다.

| 필드 | 의미 |
| --- | --- |
| scope | `document`: 직접 기록, `feature`: 같은 그룹의 구현 기록 |
| recordCount, sources | Files 블록 수(none 포함)와 출처 문서 경로 |
| files[] | 경로순의 `path`, `isDirectory`, 선택 `targetId`, `records[]` |
| records[] | `documentId`, `sourcePath`, `title`, `section`, `anchor`, `refs`, `kind`, 선택 `oldPath` |

내부 추출 기록의 line은 front matter 제거 후 소스의 1-based 줄이며 외부 파일 열기 계약이 아니다.
기존 수집·제외·심볼릭 링크·loopback·문서 재검사 정책을 유지하고, Files 문자열이 임의 파일 제공 권한이 되지 않게 한다.
문서 수정·추가·삭제는 기존 감지/SSE 재수집을 사용한다. 소스 파일 감시를 추가하지 않는다.

### 읽기 화면 — DC-46, 최종 UX 인수 TBD

- 문서 경로 아래 `Related files N` 버튼을 두고 기본은 닫는다. native dialog를 열어 본문 재배치 없이 목록을 표시한다.
  데스크톱은 오른쪽 450px, 900px 이하는 전체 폭이며 앱 헤더 아래 높이를 사용한다. 배경은 모달 처리한다.
- 출처를 `Recorded in this document` / `From this feature’s implementation plan`과 원본 경로로 표시한다.
  같은 기능의 구현 기록을 그 문서의 정밀 파일 소유 관계로 표현하지 않는다.
- 파일은 최상위 폴더/루트로 묶는다. `.md`는 Documentation으로 따로 묶어 기본 접고, 필터 중에는 펼친다.
  파일별 기록 수를 표시하고 펼치면 단계 링크·Refs·그 단계의 과거 변경 종류·이름 변경 전 경로를 보여준다.
- 패널 필터는 NFC/소문자·공백 AND로 경로·이전 경로·단계 경로·Refs를 검색한다. 파일명과 단계명이 동시에 검색 대상이다.
- 경로 복사에 Clipboard API를 쓰고 실패하면 선택 가능한 경로 input을 제공한다. 수집된 문서는 Open document,
  단계 링크는 기존 뷰어/앵커·브라우저 이력으로 이동한다. 코드 뷰어나 IDE 프로토콜은 추가하지 않는다.
- Esc·닫기·바깥 클릭으로 닫고 초점을 복귀시킨다. 패널 열기/닫기는 본문/원문 모드·URL·읽기 위치를 바꾸지 않는다.
  자동 갱신 때 필터·펼친 기록·목록 스크롤을 보존한다. 단계/문서 링크·그룹/파일 펼침·복사/대체 입력을 모두 안정된 키로 복구한다.
  초점 대상이 사라지거나 보이지 않으면 패널 검색창으로 옮기고, 복사 대체 입력은 선택 범위를 함께 복구한다.
  문서 이동은 패널을 닫고 필터를 초기화하며, 선택 삭제 시 낡은 파일 목록을 비운다.
- 닫힌 동안에는 데이터·개수·출처만 갱신하고 목록 DOM은 만들지 않는다. 열 때 최신 목록을 만들고,
  데이터/필터 변화 없는 재열기는 기존 DOM을 재사용한다. 닫힌 동안 갱신된 옛 목록은 비워 낡은 링크를 남기지 않는다.
- 기록 없음과 필터 일치 없음은 별도로 안내한다. 기록이 부분적이며 현재 Git 상태가 아니라는 문구를 하단에 둔다.

### 왼쪽 검색 — DC-47

- 기존 왼쪽 검색을 `Search docs or files…`로 안내한다. 문서마다 같은 연결 함수의 현재/변경 전 경로를 중복 제거해
  `related file` 필드를 추가한다. 제목 100·기능 80·문서 경로 60·이전 문서 경로 50·직접 파일 기록 45·
  기능 파일 기록 25·설명 20·본문 1의 가중치를 사용한다. 다른 일치 조건이 같으면 직접 기록 문서가 앞선다.
- 기존 공백 AND·NFC·대소문자 무시·200자 제한·최대 50개·동점 경로순을 유지한다.
  소스 파일 내용은 검색하지 않고 기록 없는 문서는 기존 본문/메타데이터 검색으로 계속 찾는다.
- 파일 필드에 일치하면 `matchedField: related file`, `matchedFiles`(최대 3개), `matchedFileCount`, `fileScope`를 반환한다.
  표시할 파일은 검색어 중 하나 이상이 해당 경로에 일치한 항목이며, 전체 검색어의 AND는 문서의 여러 필드에 걸쳐 판정한다.
- 결과는 문서 단위다. `File recorded here` / `File recorded for this feature`와 일치 경로·강조를 본문 문맥 대신 표시하고,
  3개를 넘는 일치는 추가 개수로 안내한다. 클릭은 문서를 열며 패널은 자동으로 열지 않는다. Show in tree 동작은 유지한다.
- 같은 generation의 기록을 사용해 저장 후 파일명/이전 이름 검색도 갱신한다. 검색어·선택·읽기 위치 보존은 기존 계약을 따른다.

### 패키지와 남은 결정 — DC-48·49

- 현재 구현은 기존 런타임 의존성 7개의 목록·버전을 유지한다. 테스트·스크린샷·임시 서버/측정 스크립트는 npm에 포함하지 않는다.
- 2026-11-04 npm 11.19.1 / Node 24.22.1의 `npm pack --dry-run --json --ignore-scripts` 비교:
  v0.6.0은 62파일, 압축 97,784바이트·해제 338,525바이트, 두 기능을 포함한 번들링 전 프로토타입은 65파일,
  압축 103,835바이트·해제 361,841바이트다. 증가 +6,051/+23,316바이트(약 6.2%/6.9%)는 docatlas 자체이며
  npm 의존성 전체·캐시·파일 시스템 할당량을 포함하지 않는다. 문서만 추가한 이번 작업은 npm 포함 파일을 바꾸지 않는다.
- 현재 UI는 DOM/ES modules/CSS다. 사용자 추가 질문(2026-11-04): 로컬 `~/project/lithent`의 ftags 방식이면
  용량이 줄어드는지 검토한다. 프레임워크 전환은 승인·구현하지 않았고 DC-49 TBD로 둔다.
  라이브러리 npm 전체 크기, 브라우저 번들, 기존 코드 최소화 효과, 실제 이식 후 npm pack을 각각 비교해야 한다.
- 로컬 비교(2026-11-04): Lithent 1.25.5 / HEAD bfd5f99, 현재 dist를 읽어 npm dry-run과 임시 Vite 빌드(write:false)를 실행했다.
  양쪽 저장소 제품 코드를 바꾸지 않았고 gzip은 Node 기본 zlib의 level 9로 계산했다.

| 비교 대상 | 원문/해제 바이트 | gzip/패키지 압축 바이트 | 측정 범위 |
| --- | ---: | ---: | --- |
| 현재 뷰어 JS 5개 합계 | 42,888 | 10,706 | gzip은 파일 원문을 이어 붙인 비교치. CSS·HTML 제외 |
| 같은 뷰어 JS 입력의 최소화 번들 | 26,426 | 8,691 | 임시 Vite/esbuild, 실제 동작 동등성·배포 pack은 미검증 |
| render·fTags·fMount 최소 예제 번들 | 12,060 | 5,059 | 코어 포함 카운터 예제. 전체 뷰어 이식본이 아님 |
| 로컬 Lithent npm 패키지 전체 | 1,602,731 | 405,028 | npm pack 337파일, 소스/타입/각 서브모듈 등 포함 |

  최소화만으로 줄어드는 양과 프레임워크 도입 효과를 같은 것으로 설명하지 않는다. 일반 런타임 의존성으로 추가하면
  npx는 해당 npm 패키지도 필요하다. 전환 후보는 빌드 단계에서 필요한 코드만 포함하는 방식이며 실제 이식본 pack/회귀가 필요하다.
  위 표는 npm tarball의 gzip과 브라우저 JS gzip의 서로 다른 범위를 명시한 비교이며 숫자를 합산해 최종 절감량으로 쓰지 않는다.
- 최소화와 리뷰 수정 후 재비교: 같은 esbuild 0.28.2·browser/ESM·ES2022·gzip9 설정에서 현재 뷰어 JS는
  26,922/8,889바이트, 코어 포함 ftags 최소 예제는 11,886/5,052바이트다. 후자의 앱은 카운터만 구현했다.
  차이 3,837바이트는 새 앱 코드의 대략적인 gzip 예산을 보는 참고치이며 gzip 합산은 정확한 손익분기가 아니다.
  상태·검색·이력·갱신 코드를 포함한 실제 동일 기능 이식본의 최종 npm pack 비교 전에는 절감을 확정하지 않는다.
- 개별 요구사항/결정 정의 구간에 파일을 연결하는 기능과 부모/자식 기능 관계 추론은 후속이다.
  최종 UX 수용(DC-46)과 프레임워크 전환 여부(DC-49)는 미정이다. 후속 사용자 요청으로 0.7.0(DC-51)을 태그 푸시로 게시한다.

## UI 번들링·최소화 — RQ-32 계약

2026-11-04 사용자 승인: 프레임워크 전환 전에 현재 UI의 번들링·최소화를 진행한다(DC-50).
개발 원본은 `src/web/`에 유지하고 기존 ESM 진입점 app.js와 styles.css를 esbuild로 묶어 최소화한다.

- esbuild 0.28.2를 정확한 버전의 devDependency로만 설치한다. 런타임 의존성·수집기 API·원본 문서 정책은 유지한다.
- `scripts/build-web.js`와 `npm run build:web`가 `src/web/dist/app.js`, `src/web/dist/styles.css`를 만든다.
  JS는 browser/ESM·ES2022, 소스맵 없음·외부 런타임 import 없음이다. CSS도 최소화하고 HTML은 기존 파일을 사용한다.
- 생성 폴더는 git에서 제외한다. prepare·check·테스트 진입에서 생성해 checkout/CI와 배포물의 누락·오래된 자산을 예방한다.
  빌드 없이 consumer 서버가 자산을 찾지 못하면 개발자를 위한 build:web 안내를 제공한다. 소비자 실행 중에는 빌드하지 않는다.
- `src/web/.npmignore`로 개발 JS/CSS 원본과 기타 생성 파일을 제외하고 dist의 두 자산만 포함한다.
  서버는 고정 `/app.js`, `/styles.css`, `/`를 제공하며 기존 개별 모듈 URL은 제공하지 않는다. CSP/loopback 경계는 유지한다.
- npm pack/publish의 자산 생성은 prepare 하나로 통일한다. prepack 빌드를 중복 연결하지 않는다.
  `--ignore-scripts`는 빌드를 생략하므로 먼저 build:web 또는 check를 실행한 입력만 검증한다.
  production-only 설치에서는 esbuild·개발 원본·빌드 스크립트 없이 서버와 새 파일 검색/패널이 동작해야 한다.
- npm 전체 압축/해제 크기는 번들 전 프로토타입 103,835/361,841바이트와 비교하고, 자산 gzip 측정과 구분한다.
  최소화 번들의 화면·검색·앵커·이력·갱신 회귀와 별도 tarball 설치를 완료 관문으로 둔다.
- 구현·검증 완료: JS 26,253바이트(gzip9 8,657), CSS 20,940바이트(gzip9 5,415).
  npm pack은 61파일·압축 100,227·해제 342,299바이트로, 번들 전보다 각각 3,608/19,542바이트 줄었다.
  0.6.0 게시본과 비교하면 새 기능을 포함한 자체 패키지는 압축 +2,443바이트다. 측정 환경은 Node 24.22.1/npm 11.19.1이다.
- 산출물은 같은 내용이면 쓰지 않고 변경 시 임시 파일에서 rename해 부분 쓰기를 막는다. `--check`는 누락/오래된 자산을 거부한다.
  빌드 로그는 stderr로 보내 npm pack --json 소비자의 stdout 파싱을 보존한다.
  check 100 JS·Node 236·Chrome 48·설치 통합 8개가 통과했고 esbuild 없는 일반 production-only 설치를 확인했다.
- 리뷰 반영 후에는 패널 초점·지연 생성 코드로 JS 26,922/gzip9 8,889바이트, npm 61파일·압축 100,464·해제 342,932바이트다.
  prepare 단일 빌드와 설치 통합 8개, 전체 Chrome 54개(관련 파일 12개 포함)를 확인했다. 이전 측정은 최초 번들링 시점의 비교로 남긴다.

## npm 게시 자동화 — RQ-21 계약

2026-11-01 사용자 결정: 버전 태그를 푸시하면 GitHub Actions가 npm Trusted Publishing(OIDC)으로 게시한다. 0.4.2부터 쓴다.
파일은 `.github/workflows/publish.yml` 하나이며 npm 패키지에는 들어가지 않는다(files는 agent-kit/·bin/·src/).

| 실행 | 하는 일 |
| --- | --- |
| 태그 `v*` 푸시 | 아래 검사를 모두 통과하면 `npm publish`로 실제 게시한다 |
| 수동 실행(workflow_dispatch) | 같은 검사 뒤 `npm publish --dry-run`만 한다. 등록·설정 확인용 리허설이며 게시하지 않는다 |

단계와 규칙:

- 실행기는 GitHub 제공 `ubuntu-latest`다(Trusted Publishing은 자체 실행기를 지원하지 않는다). Node 24를 쓰고 setup-node에
  registry-url `https://registry.npmjs.org`를 준다. 저장소 비밀값의 npm 토큰은 쓰지 않는다.
- 권한: 워크플로 기본은 `contents: read`, 게시 작업만 `id-token: write`를 더한다. 같은 게시가 겹치지 않게 concurrency 그룹 하나를 둔다.
- checkout은 전체 이력(fetch-depth 0)과 persist-credentials false로 한다.
- 게시 대상 확인: 실행 커밋이 origin/main에 포함돼야 한다. 태그 실행이면 태그 이름이 `v` + package.json version과 같아야 한다.
  둘 중 하나라도 어긋나면 게시 전에 실패한다.
- npm 버전: Trusted Publishing은 npm 11.5.1 이상이 필요하다. Node 24에 들어 있는 npm이 그보다 낮을 때만 npm@11을 설치한다.
- 검사: `npm ci --ignore-scripts --no-audit --no-fund`, `npm run check`, `npm test`, `npm pack --dry-run`. 플랫폼·브라우저 검사는
  main에 푸시할 때 도는 Platform checks가 맡으므로, 태그는 그 CI가 통과한 main 커밋에 건다.
- 게시: `npm publish`. package.json publishConfig(public, npm registry)를 따른다. 공개 저장소의 공개 패키지라 출처 표시(provenance)는
  npm이 자동으로 만든다. `--provenance`는 쓰지 않는다.
- 사용자 등록: npmjs.com 패키지 설정의 Trusted Publisher(GitHub Actions, superlucky84/docatlas, `publish.yml`, environment 없음),
  또는 `npm trust github docatlas --file publish.yml --repo superlucky84/docatlas --allow-publish`. 이름은 대소문자까지 같아야 하며
  npm은 저장할 때 검증하지 않으므로 잘못된 값은 게시할 때 실패로 드러난다.
- 실패 처리: 등록 전에 태그를 푸시해 게시 단계만 실패하면, 등록한 뒤 같은 실행을 다시 실행(re-run)한다. 이미 게시한 버전의 태그는 옮기지 않는다.
- 0.4.2: 337200b에는 workflow가 없으므로 workflow를 더한 main 커밋에 `v0.4.2`를 건다. package.json·lockfile·패키지 내용은 337200b와 같다.
  구현됨: 2026-11-01 v0.4.2(556d0f0) 태그로 run 41277271628이 게시했고 provenance가 붙었다.

## 개인 문서와 백업 — RQ-22·23 계약

2026-11-01 사용자 선택(DC-32): `.docatlas/private/<기능>/`, `.git/info/exclude`로 숨김, 문서 지도의 별도 Private 그룹, designer 위에 얹는 얇은 스킬.
같은 날 DC-33~36도 사용자가 제안대로 정했다("전부 추천대로"). 구현은 구현 계획의 단계에서 진행한다.

### 구조

```text
<root>/
  .docatlas/
    agents.json              프로젝트 설치 기록(기존, 커밋 대상)
    private/                 개인 문서. .git/info/exclude로 숨긴다
      <기능>/
        REQUIREMENTS.md  DESIGN.md  IMPLEMENT.md  MANUAL_TEST_CHECKLIST.md
        (추가 문서·이미지)
```

- 개인 문서는 루트의 `.docatlas/private/` 한 곳에 기능별 폴더로 모은다. 하위 폴더의 `.docatlas/`는 개인 문서 위치가 아니다.
- 기능 폴더 이름은 짧은 영문 소문자-하이픈을 제안한다. 기능 경계가 불분명하면 에이전트가 이름을 제안하고 사용자가 정한다.
- 문서 작성 규칙은 designer와 같다(4종 문서·결정·phase·Refs/Files·인계). Refs·Files의 경로는 저장소 루트 기준이라
  문서가 코드 옆에 없어도 관련 코드 위치를 그대로 가리킨다(RQ-20이 이 기능의 사전 작업인 이유).
- 개인 문서는 공개 문서나 코드에서 링크하지 않는다. 개인 문서에서 공개 문서로 거는 상대 링크는 허용한다.

### git 숨김 — 1단계 구현

- 위치(2026-11-01 사용자 선택): git 작업 트리 안이면 명령을 어느 폴더에서 실행하든(`--root` 포함) 저장소 최상위의 `.docatlas/private/`를 쓴다.
  그래서 패턴은 항상 `/.docatlas/private/`다. 하위 폴더에서 연 문서 지도에는 개인 문서가 보이지 않는다.
  git 밖이면(2026-11-01 최종 사용자 선택) 시작 폴더(실행한 폴더 또는 `--root`)가 루트다. 위로 찾지 않는다(이전의 위쪽 찾기 규칙은 단순화로 없앴다).
  루트의 `.docatlas` 안을 읽을 수 없으면 명령은 아무것도 쓰지 않고 실패(종료 1)로 끝난다.
- 홈 막기(2026-11-01 사용자 선택): 정해진 루트가 홈 폴더 자체나 그 위면(git 최상위가 홈인 dotfiles 저장소 포함) `blocked home`, 종료 3이다.
  홈의 `~/.docatlas/`는 설치 기록과 백업 자리라 개인 문서와 섞지 않는다.
- git 질의는 `rev-parse --is-inside-work-tree --show-toplevel --git-path info/exclude` 한 번으로 한다. worktree·submodule은 각자의 exclude 파일을 쓴다.
  git hook이 내보내는 GIT_DIR·GIT_WORK_TREE·GIT_INDEX_FILE·GIT_COMMON_DIR·GIT_NAMESPACE·GIT_PREFIX는 지우고 실행해 다른 저장소를 건드리지 않는다.
- 판정은 git에게 맡긴다(2026-11-01 단순화). git은 영어 메시지(LC_ALL=C·LANGUAGE=C)로 실행한다.
  - 질의가 성공하고 작업 트리면 저장소. 첫 출력이 `false`면(성공·실패와 관계없이, bare 저장소와 `.git` 안) not-work-tree로 막는다.
  - 실패 메시지가 "not a git repository"면 git 밖으로 보고 경고만 한다. GIT_CEILING_DIRECTORIES·파일 시스템 경계·빈 `.git` 같은 판단은 git의 것을 그대로 따른다.
  - 그 밖의 오류(예: 소유자가 다른 저장소)는 git-error로 종료 3.
  - git을 실행할 수 없으면(ENOENT·EACCES 등) 시작 폴더부터 위로 `.git` 항목이 있는지만 본다. 있으면 git-missing으로 종료 3, 없으면 git 밖 경고.
  모두 아무것도 쓰지 않는다. 숨겼는지 확인할 수 없을 때 성공으로 보고하지 않기 위해서다.
- exclude 파일에 패턴 줄이 없으면 주석 한 줄(`# docatlas private documents (docatlas private init)`)과 패턴을 덧붙인다. 중복해서 쓰지 않는다.
  줄 비교는 git처럼 뒤 공백만 무시한다(앞 공백은 패턴의 일부다). 새로 만드는 `private` 폴더는 0700이다(같은 컴퓨터의 다른 사용자가 읽지 못하게).
  sudo 등 다른 사용자로 실행하면 exclude와 폴더의 소유자가 바뀔 수 있다. 실행 사용자는 저장소 소유자여야 한다(알려진 한계, 막지 않음).
  기존 내용은 바이트 그대로 두고 CRLF와 마지막 줄바꿈을 따르며, 임시 파일에 쓰고 권한을 맞춘 뒤 이름을 바꾼다. `.gitignore`는 고치지 않는다.
- `git ls-files`에 추적된 개인 파일이 있으면 숨김 대신 멈춘다(종료 3, 아무것도 쓰지 않음). 이미 커밋된 개인 문서는 사용자가 정리한다.
- `.docatlas`·`private`·exclude 파일·`info` 폴더가 심볼릭 링크거나 종류가 다르면 멈춘다. 폴더를 만들기 직전에 다시 확인한다.
  동시 실행 잠금은 두지 않았다(Test Hardening에서 정한다).
- init은 쓴 뒤 `git check-ignore -q -- .docatlas/private/`로 실제로 숨겨졌는지 확인한다. `.gitignore`의 `!` 규칙처럼 다른 규칙이 폴더를 다시 보이게 하면
  not-ignored로 종료 3을 내고 사용자에게 보이게 한다(같은 init을 반복하라고 안내하지 않는다). `--dry-run`도 패턴 줄이 이미 있으면 같은 확인을 한다.
- 노출 판정은 Markdown뿐 아니라 개인 폴더의 모든 파일(이미지 등)로 한다. status는 documents(Markdown)와 files(전체)를 따로 보여 준다.

### 명령과 모듈(DC-35) — 1단계 init·status·help, 3단계 backup·list·restore 구현

- 새 모듈 `src/private/`: 위치 준비, 숨김 확인, 백업, 목록, 복구. 수집기·서버·화면·agent-kit과 독립이다.
- 명령: `docatlas private init | status | backup | list | restore | help`. agents 명령처럼 대화형 입력 없이 탭 구분 결과 줄과 종료 코드를 내고,
  `restore`는 `--dry-run` 미리보기를 지원한다. `help`는 에이전트가 읽고 실행할 순서를 안내한다.
  - init: `.docatlas/private/`를 만들고 git 숨김 규칙을 확인·추가한다.
  - status: 개인 문서 수, 숨김 상태, 마지막 백업과의 차이를 보여 준다.
  - backup·list·restore: 아래 "백업과 복구". `--key`는 이 세 명령, `--keep`은 backup, `--from`·`--force`는 restore, `--dry-run`은 init·restore에만 쓴다.
- 결과 줄: 두 명령 모두 첫 줄에 `root <폴더>`. init은 `<action> folder`, `<action> exclude <파일> <패턴>`, `warning not-git`, `blocked <이유> <경로>`,
  `summary`. status는 folder·documents·files·git·exclude·ignored·tracked·backup·summary(ok|empty|exposed|tracked|blocked|not-git).
- 결과 줄(3단계): backup·list·restore는 `root` 다음에 `key <키> <origin|local|option>`과 `store <키 폴더>`를 낸다.
  - backup: `warning no-origin`, `warning <symbolic-link|wrong-type|unsupported-name> <루트 기준 경로(.docatlas/private/…)>`(복사하지 않은 항목),
    `<create|unchanged|skip> backup <백업 폴더 또는 ->`, `remove backup <지운 백업 폴더>`, `summary backup=<action> files=<n> removed=<n>`.
  - list: `backup <이름> <createdAt> <파일 수> <backup|before-restore> <commit 또는 ->`(최신순), `warning invalid-backup <폴더>`, `summary backups=<n>`.
  - restore: `from <이름> <createdAt> <파일 수> <reason>`, init과 같은 folder·exclude 줄, `--force`면 `<create> backup <복구 전 백업 폴더>`,
    `<create|unchanged|conflict|overwrite> file <경로>`, `blocked <symbolic-link|wrong-type> <경로>`,
    `summary create=<n> unchanged=<n> conflict=<n> overwrite=<n> blocked=<n>`. `--dry-run`이면 동작 줄과 summary가 `dry-run`으로 시작한다.
    백업이 없으면 `missing backup <폴더>`, 백업이 손상됐으면 `blocked damaged <경로>` 또는 `blocked invalid-backup <폴더>`로 아무것도 쓰지 않는다.
    `--force`의 복구 전 백업은 현재 파일을 읽으므로 backup과 같은 `warning` 줄을 낼 수 있다.
- 종료 3의 뜻: agents는 "완료했지만 결정 필요"이고, private init은 "쓰기 전에 멈춤" 또는 "줄은 썼지만 git이 아직 폴더를 봄", status는 "사용자가 봐야 할 상태"다.
  backup은 "쓰기 전에 멈춤"(막힌 경로) 또는 "나머지는 백업했지만 이름에 `\`가 있는 파일을 뺐음"(리뷰 반영), restore는 "쓰기 전에 멈춤"(백업 없음·손상·막힌 경로·숨기지 못함) 또는
  "나머지는 복구했지만 conflict나 blocked 파일이 남음"이다. list는 백업이 없어도 0이다.
- 쓰기는 `.docatlas/private/`, `.git/info/exclude`, 백업 위치로 한정한다. 심볼릭 링크는 따라가지 않는다.

### 백업과 복구(DC-34) — 3단계 구현

- 백업 위치: `~/.docatlas/private-backups/<프로젝트 키>/<UTC 시각>/`. 시각 이름은 `YYYYMMDDTHHMMSSZ`(Windows가 금지하는 `:` 없음)이고
  같은 초에 겹치면 `-2`, `-3`을 붙인다. 각 백업은 `manifest.json`과 `files/`(개인 폴더 기준 상대 경로 그대로)다.
  manifest(format 1): createdAt(ISO 시각), key, reason(`backup` | `before-restore`), root(만든 작업 폴더), commit(HEAD 또는 null),
  files(`{ path, size, sha256 }`, `/` 구분 상대 경로, 경로 순). 원격 주소 원문은 계정 정보가 섞일 수 있어 담지 않는다.
- 백업은 같은 키 폴더 안의 임시 폴더(`.partial-…`)에 파일과 manifest를 모두 쓴 뒤 시각 이름으로 바꾼다. 실패하면 임시 폴더를 지운다.
  그래서 manifest가 없거나 읽을 수 없는 폴더는 백업이 아니다(list가 경고). 새로 만드는 백업 폴더는 0700, 파일은 0600이다.
- 백업 위치의 `.docatlas`·`private-backups`·키 폴더·백업 폴더가 심볼릭 링크거나 폴더가 아니면 막는다(종료 3). 동기화 폴더 지정은 TBD다.
- 파일 공유(2026-11-01 사용자 선택): 새 백업의 파일이 같은 키의 기존 백업 파일과 해시가 같으면 복사하지 않고 그 파일에 하드 링크를 건다.
  링크하기 전에 그 파일을 읽어 크기·해시를 다시 확인하고, 링크를 못 하면(파일 시스템 미지원·링크 수 초과·그 사이 지워짐 등) 복사한다.
  각 백업 폴더는 완전한 파일 트리로 보이며, 오래된 백업을 지워도 공유한 데이터는 남는다. 백업 파일은 만든 뒤 고치지 않는다
  (사람이 백업 파일 하나를 고치면 공유하는 백업도 같이 바뀌고, 복구가 해시 불일치로 알린다).
  zip이나 탐색기·Finder 복사로 옮기면 공유가 풀려 백업마다 한 벌씩 생기지만 내용은 같다. tar는 하드 링크를 유지한다.
- 프로젝트 키: git의 `remote.origin.url`을 정규화한다. 계정 정보·포트·끝의 `/`와 `.git`을 지우고 `호스트/경로`로 만든 뒤 소문자로 바꾼다
  (Windows·macOS 폴더는 대소문자를 구분하지 않는다). 그래서 `https://`·`ssh://`·`git://` 주소와 `git@host:owner/repo`가 같은 키가 된다.
  로컬 경로 원격은 `file/<경로>`다. 각 부분에서 Windows가 금지하는 문자(`<>:"\|?*`, 제어 문자)와 공백은 `-`로 바꾸고 끝의 점은 지우며,
  `.`·`..`·빈 부분은 버리고, Windows 예약 이름(con 등)에는 앞에 `_`를 붙인다.
  origin이 없거나 git 밖이면 `local/<루트 폴더 이름>-<경로 구분값>`과 경고(no-origin)다. 경로 구분값은 루트 절대 경로의 SHA-256 앞 8자
  (Windows·macOS에서는 경로를 소문자로 바꾼 뒤)이며, 다른 위치의 같은 이름 폴더가 백업을 섞거나 서로 지우지 않게 한다(2026-11-01 사용자 선택).
  폴더를 옮기면 키가 바뀌므로 `--key`로 이전 키를 지정한다. `--key <키>`로 바꿀 수 있다
  (`/`로 이은 부분이 모두 위 규칙을 이미 지키는 값. 소문자로 바꾸며, 아니면 종료 2). 그래서 출력된 키는 그대로 `--key`에 쓸 수 있다.
- backup: 루트의 `.docatlas/private/` 아래 모든 일반 파일(이미지 포함)을 복사한다. 심볼릭 링크와 다른 종류는 복사하지 않고 경고한다.
  파일이 하나도 없으면 백업하지 않는다(skip). 빈 백업이 최신이 되어 복구할 백업을 가리지 않게 하기 위해서다.
  이름(경로)에 `\`가 있는 파일은 macOS·Linux에서는 만들 수 있지만 Windows에서 복구할 수 없고 manifest 경로로도 쓸 수 없어,
  `warning unsupported-name`으로 알리고 빼며 나머지를 백업한 뒤 종료 3이다(2026-11-01 리뷰 반영, 사용자 선택). 이름을 바꾸면 다음 백업에 들어간다.
  백업은 manifest를 쓰기 전에 list·restore와 같은 검사로 확인해, 읽을 수 없는 백업을 성공으로 보고하지 않는다.
  최신 일반 백업(reason backup)과 경로·해시가 모두 같으면 새로 만들지 않는다(unchanged).
- 보관 개수(2026-11-01 사용자 변경, 처음에는 모두 보관): backup이 create나 unchanged로 끝나면 그 키의 백업을 최신 N개만 남기고 나머지를 지운다.
  N은 기본 10이고(같은 날 3에서 변경, 사용자 선택) `--keep <n>`(1~1000의 정수, backup에만)으로 그 실행에서만 바꾼다.
  설정 파일에 저장하지 않으므로 기본 실행은 다시 10개로 줄인다.
  - 순서는 백업 이름(UTC 시각)이고 종류(backup·before-restore)를 가리지 않고 센다. 방금 만든 백업은 시계가 틀려 이름이 오래돼 보여도 지우지 않는다.
  - 파일이 없어 백업하지 않은 실행(skip)은 아무것도 지우지 않는다. 폴더를 비운 뒤에도 복구할 백업이 남게 하기 위해서다.
  - restore(`--force`의 복구 전 백업 포함)·list·status는 지우지 않는다. 복구 중인 백업을 지우지 않게 하기 위해서다.
  - manifest를 읽을 수 있는 백업 폴더(실제 폴더, 링크 아님)만 지운다. 잘못된 백업 폴더와 `.partial-…` 폴더는 그대로 둔다.
  - 지운 백업마다 `remove backup <폴더>` 줄을 내고 summary에 `removed=<n>`을 더한다.
- list: 키의 백업을 최신순으로 보여 준다. 백업이 없어도 종료 0이다.
- restore: 기본은 최신 일반 백업이다. `--force`가 만드는 복구 전 백업(reason before-restore)은 목록에 보이고 `--from <이름>`으로만 고른다.
  1. init과 같은 확인(홈, git, 개인 폴더 링크, 추적 파일, exclude 링크)에서 막히면 아무것도 쓰지 않는다.
  2. 백업을 검증한다. manifest 경로가 안전한 상대 경로인지, 각 파일의 크기·해시가 맞는지 본다. 하나라도 틀리면 아무것도 쓰지 않는다(종료 3).
  3. 파일마다 계획을 세운다: 없으면 create, 같으면 unchanged, 다르면 conflict, 경로나 그 부모가 링크거나 폴더가 아니면 blocked.
     `--dry-run`은 여기까지 보여 주고 끝난다. 숨김 줄이 이미 있으면 init처럼 check-ignore로 숨겨지는지도 미리 본다.
  4. 숨김 줄을 먼저 넣는다(init과 같은 폴더 만들기·exclude 추가·check-ignore 확인). 숨겨지지 않으면 파일을 쓰지 않고 종료 3이다.
  5. `--force`이고 conflict가 있으면 현재 개인 폴더 전체를 먼저 백업한다(before-restore). 그 뒤 conflict는 overwrite가 된다.
  6. 파일을 쓴다. 새 파일은 같은 폴더의 임시 파일에 쓴 뒤 hard link로 놓아(Test Hardening) 다 쓴 파일만 보이고 기존 이름은 바꾸지 않는다.
     hard link를 못 쓰는 파일 시스템이면 배타적 생성(`wx`)으로 쓴다. 덮어쓰기는 임시 파일을 쓴 뒤 이름 바꾸기라 링크를 따라가지 않는다.
     백업에 없는 현재 파일은 지우지 않는다. conflict나 blocked가 남으면 나머지를 복구한 뒤 종료 3, 아니면 0이다.
- status는 summary 앞에 `backup <same|changed|none|unknown> <최신 일반 백업 이름 또는 ->` 줄을 더한다. summary 값은 그대로다.
- 백업 시점(2026-11-01 사용자 변경, 처음에는 문서를 고칠 때마다): 명령으로 한다. 에이전트가 스스로 실행하는 때는 구현 phase마다 한 번,
  할 수 있는 구현과 자동 테스트를 모두 마치고 사용자의 수동 확인만 남았을 때다(개인 문서 스킬과, 개인 문서로 일하는 implementer).
  그 밖에는 사용자가 명시적으로 요청할 때만 한다. 요구사항·설계 문서를 쓰거나 고친 것만으로는 백업하지 않는다.
  문서 지도는 읽기 전용 원칙대로 백업하지 않는다.
- 복구는 자동이 아니다(clone은 프로그램을 실행시키지 않는다). 잊지 않도록 두 안내를 둔다.
  (1) 문서 지도 시작 때 루트의 `.docatlas/private/`에 파일이 없고 같은 키의 일반 백업이 있으면 터미널에 한 줄
  `Private documents: a backup from <YYYY-MM-DD HH:MM UTC> is available. Restore with: docatlas private restore --dry-run`을 출력한다.
  지도 루트가 git 최상위가 아니면(하위 폴더에서 연 지도) 안내하지 않는다. 실행 폴더에서 찾은 루트가 지도 루트와 다르면 명령에 `--root <루트>`를 붙인다.
  스킬 업데이트 안내(PR-10)와 같이 읽기만 하고, 안내를 만들지 못해도 지도 실행에 영향을 주지 않는다.
  (2) 개인 문서 스킬은 새 문서를 만들기 전에 폴더가 비어 있고 백업이 있으면 복구할지 먼저 묻는다. 묻지 않는 자동 복구는 없다.
- 백업 위치를 클라우드 동기화 폴더로 바꾸는 옵션(`--to` 또는 설정)은 TBD.
  2026-11-03 후속 검토(RQ-24)는 로컬 저장소를 유지하고 별도 사본을 보내는 방식을 먼저 제안한다. 아래 검토 절을 따른다.
- 동시 실행(Test Hardening 결정, 설계 제안): 잠금 파일을 두지 않는다. 모든 쓰기가 원자적이거나 배타적이라 동시에 실행해도 파일이 깨지거나 사라지지 않는다.
  백업 폴더와 exclude는 임시 파일·폴더를 쓴 뒤 이름 바꾸기, 새 개인 파일은 임시 파일 뒤 hard link(없으면 `wx`), 덮어쓰기는 임시 파일 뒤 이름 바꾸기다.
  남는 영향은 같은 내용의 백업이 여러 개 생길 수 있다는 것(같은 초면 `-2`·`-3` 이름)과, 보관 개수 정리가 겹치면 동시에 끝난
  다른 실행이 방금 만든 백업을 지울 수 있다는 것이다. 최신 백업은 항상 남고 기본 10개라 사실상 영향이 없다. 잠금은 중단된 실행이 남긴 잠금을 풀 규칙이 필요해
  얻는 것보다 복잡하다. 복구가 만들려던 파일을 다른 실행이 먼저 만들었으면 내용을 비교해 같으면 unchanged, 다르면 conflict로 본다.
- 검사와 쓰기 사이 재확인: restore는 숨김 줄을 넣은 뒤 파일을 쓰기 전에 개인 폴더를 다시 확인하고(링크로 바뀌었으면 쓰지 않고 종료 3),
  폴더를 하나씩 만들며 각 부모가 실제 폴더인지 본다. backup은 파일을 읽은 뒤 개인 폴더를 다시 확인해, 읽는 사이 링크로 바뀌었으면 백업하지 않는다.
  같은 사용자가 그 짧은 사이에 경로를 바꾸는 경우까지 막지는 않는다(Node에 openat 계열이 없어서, 알려진 한계).
- 중단된 백업(프로세스 강제 종료)이 남긴 `.partial-…` 폴더는 백업으로 보지 않고 지우지도 않는다(알려진 한계, 정리는 백업 정리 기능과 함께 후속).

### 문서 지도(DC-36) — 2단계 구현

- 수집기는 루트의 `.docatlas/private/**/*.md`를 공개 문서와 별개의 고정 출처로 읽어 최상위 Private 그룹 아래 기능별로 보여 준다.
  읽기 모델의 문서에 private 표시를 두고, 화면은 배지로 구분하며 검색 결과에도 표시한다.
- 기본 exclude의 `**/.docatlas/**`는 그대로 둔다. 하위 폴더의 `.docatlas/`와 루트의 다른 파일(agents.json 등)은 계속 수집하지 않는다.
- 심볼릭 링크·루트 경계·읽기 시 재검사 정책은 공개 문서와 같다. 개인 문서 폴더는 원래 git 밖이므로 저장소 `.gitignore` 규칙을 적용할지,
  설정(include/exclude)이 Private 그룹에 영향을 주는지는 DC-36으로 정했다: 영향을 받지 않는 고정 출처이며 저장소 .gitignore도 적용하지 않는다.
  지도에서 끄는 설정은 후속이다.
- 구현(2단계): 경로 규칙 하나(`isPrivatePath`, collector/policy.js)를 수집기·`acceptsPath`(실시간 감지 필터·이전 경로)·서버의 읽기 검사가 함께 쓴다.
  `.docatlas/private`와 그 아래, 그리고 그곳으로 가는 `.docatlas` 폴더 자체만 예외이고 `.docatlas/agents.json` 같은 다른 파일은 그대로 제외된다.
  메인 탐색은 `.docatlas/private`를 건너뛰고(설정이 `.docatlas`를 제외하지 않아도 두 번 모으지 않음) 별도 탐색이 모든 `.md`를 모은다.
  `.docatlas`·`private`·그 안의 링크는 건너뛰고 경고한다. 문서와 그룹에는 `isPrivate: true`를 붙이고(공개 항목에는 속성을 두지 않음),
  `.docatlas/private` 그룹은 부모가 `.`이고 제목은 항상 Private이며 루트의 하위 목록 맨 뒤에 둔다. groups 설정은 개인 그룹에 적용하지 않는다.
  검색 결과에 `isPrivate`를 싣고, 화면은 Private 그룹 줄에 "Only on this computer", 개인 문서 줄에 옅은 표시, 문서 머리·검색 결과에 Private 배지를 둔다.
  지도는 열린 루트의 개인 폴더만 읽는다(git 최상위가 아니라 지도 루트).

### 개인 문서 스킬(DC-33) — 4단계 구현

- 이름: `doc-driven-private-v1`(스킬과 룰 한 쌍). 사용자가 개인·비공개 문서를 명시적으로 요청할 때만 쓴다는 설명을 둔다.
- 4단계 구현: 항목 version 1.0.0, kit 1.3.0, manifest `default: false`, `requires: ["doc-driven-designer-v1"]`.
  agents help의 항목 줄은 `with --all or --only; needs doc-driven-designer-v1`이고, 에이전트 순서 1번에
  "다른 항목이 필요한 항목은 그 항목도 설치돼 있어야 동작하므로 --only로 함께 고른다"를 더한다.
- 스킬 구성(얇게): 범위(명시 요청에만, 나머지는 designer), 위치(루트의 한 폴더, 기능별, 짧은 소문자-하이픈 이름, 코드 옆 배치 규칙 미적용),
  쓰기 전(init → 파일이 없으면 list로 백업 확인 → 있으면 복구 여부를 묻기 → 미리보기 → 동의 뒤 복구, `--force`는 사용자가 요청할 때만, 종료 3이면 멈춤),
  작성 규칙(stage·commit 금지, 추적 파일·커밋 메시지·PR에 경로나 링크 금지, 개인 → 공개 상대 링크 허용, Refs·Files는 designer와 같고
  git이 개인 파일을 보지 않으므로 Files에는 저장소 파일만 나옴, 인계는 기능의 개인 IMPLEMENT.md, implementer·reviewer에게 개인 문서 경로 전달),
  백업(구현 phase에서 에이전트 몫을 마쳤을 때 한 번과 사용자 요청 때만, 같은 날 변경. no-origin 경고면 새 clone에서 `--key`가 필요함을 알림),
  찾기(공개 문서와 개인 폴더 모두 검색).
  명령이 설치돼 있지 않으면 `npx docatlas private …`를 쓴다.
- implementer·reviewer는 사용자가 개인 문서 경로를 알려 주면 그 문서로 일한다. 같은 날 사용자 변경으로 implementer 1.3.0에 한 줄을 더한다:
  phase 문서가 `.docatlas/private/` 아래에 있으면 phase 끝에 문서를 맞춘 뒤 `docatlas private backup`을 한 번 실행한다. reviewer는 파일을 고치지 않아 그대로다.
- 내용: 문서 작성은 doc-driven-designer-v1을 따른다. 위치(`.docatlas/private/<기능>/`), 숨김 확인(init), 개인 문서를 stage·commit하거나
  추적 파일에서 링크하지 않기, Refs·Files는 저장소 루트 기준, 구현 phase 끝과 요청 때 백업, 관련 문서를 찾을 때 공개·개인 문서를 함께 보기를 담는다.
- 설치(2026-11-01 사용자 변경): manifest에서 default false다. `agents install`의 기본 대상(세 쌍)에는 들어가지 않고,
  `--all` 또는 `--only doc-driven-private-v1`로 설치한다. 기존 설치 코드가 default false 항목을 이미 이렇게 다루므로 설치 동작은 바꾸지 않는다.
  designer 위에 얹는 스킬이라 designer가 없으면 동작하지 않는다. `--only`로 private만 고르면 도움말·안내에서 designer도 함께 고르라고 알린다.
  명시적 요청에만 쓰이도록 설명으로 제한한다. 스킬·룰을 더하면 kit 버전·manifest·METHOD·README·agent-kit/README를 함께 고친다.
- 새 문서를 만들기 전에 폴더가 비어 있고 백업이 있으면 복구할지 먼저 묻는다.

## 클라우드 백업과 새 컴퓨터 복구 — 검토 이력과 구현 계약

2026-11-03 사용자 용도 선택: 클라우드에 백업하고 필요할 때 새 컴퓨터에서 복구한다.
전용 스킬·에이전트 룰 중심의 작업 방향과 명시적 요청에만 실행하는 정책(RQ-26/DC-42)을 확인했다.
아래 방식 비교는 구현 승인 전의 검토 이력이다. 당시 미확정 사항은 뒤의 "확정 구현 계약"과 DC-37~44에서 해소했으며, 0.6.0으로 구현·게시했다.

### 현재 코드에서 재사용할 부분과 제약

- `src/private/store.js`: manifest의 상대 경로·크기·SHA-256, 완성 후 이름 바꾸기, 동일 내용 건너뛰기, 로컬 백업 기본 10개와 하드 링크 공유.
  `src/private/command.js`: 복구 전 전체 파일 검증, git 숨김, 미리보기, 충돌 보존과 강제 복구 전 백업.
- `src/private/key.js`: origin이 같은 clone은 주소 표현(SSH/HTTPS)이 달라도 같은 프로젝트 키를 쓴다.
  origin 없는 키는 절대 경로에서 나오므로 새 컴퓨터에서는 이전 키를 선택하거나 별도 식별자를 연결해야 한다.
  키는 문서를 찾는 분류값이며 계정 인증이나 저장소 소유권 증명이 아니다. 같은 origin의 branch·worktree도 같은 키다.
- 현재 자동 백업은 에이전트가 phase 끝에 명령을 실행하는 규칙이다. 상시 실행 감지기나 예약 작업은 없다.
  현재 restore는 로컬 저장소만 읽는다. 클라우드 다운로드·로그인·경로 설정 옵션은 없다.
- 기존 백업 폴더를 심볼릭 링크로 클라우드 폴더에 연결하면 경로 보호 검사에서 막힌다.
  하드 링크의 공간 절약과 로컬 rename의 완성 보장은 클라우드 전송에서도 유지된다고 가정할 수 없다.
  같은 초의 백업 이름은 컴퓨터 사이에서 겹칠 수 있고, 로컬 10개 정리를 공유 폴더에 적용하면 다른 컴퓨터의 사본도 지울 수 있다.

### 연결 방식 비교

부담 평가는 현재 코드와 공식 문서에서 도출한 설계 판단이며, 구현·성능 측정 결과가 아니다.

| 방식 | 사용 흐름 | 장점 | 추가 책임과 적합성 |
| --- | --- | --- | --- |
| 클라우드 동기화 폴더 지정(첫 추천) | Drive·OneDrive·Dropbox·iCloud 등의 설치된 앱이 관리하는 실제 폴더에 별도 백업 사본을 쓴다. | docatlas에서 OAuth나 서비스 SDK 없이 시작한다. 사용자의 기존 계정·클라이언트를 이용한다. | 변경량이 가장 작을 것으로 예상한다. 지원 OS·클라이언트 설치·파일 다운로드 상태에 의존하며 폴더 쓰기 성공으로 원격 업로드를 확인할 수 없다. |
| rclone 연결 | 사용자가 remote를 설정하고 docatlas가 완성된 사본을 전송·다운로드한다. | 여러 저장소를 한 전송 도구로 지원하고 crypt로 업로드 전 암호화할 수 있다. | 외부 실행 파일 설치, remote 설정과 인증, 종료·재시도 관리가 필요하다. 데스크톱 클라우드 앱이 없는 환경의 후속 후보다. |
| 서비스 API 직접 연결 | 예: Google 로그인 후 Drive API로 백업을 보내고 새 기기에서 받는다. S3는 별도 자격 증명으로 접근한다. | 클라이언트 폴더 없이 CLI에서 연결·전송 결과를 관리한다. 자체 저장 서버는 필수가 아니다. | provider별 인증·토큰 보관·할당량·오류·배포 앱 설정을 유지한다. 로그인 중심 제품 경험이 중요해지면 검토한다. |
| 별도 개인 비공개 Git 저장소 | 팀 origin과 분리한 저장소에 백업 사본 또는 문서 이력을 커밋·push한다. | 기존 Git 인증·전송·이력을 이용한다. | 이 용도에는 별도 저장소 관리·push 충돌·이력 보관이 더해진다. 현재 private 스킬의 커밋 금지 규칙과 새 저장소의 관계도 정의해야 한다. |

Windows/macOS 공통 후보(사용자 질문, 서비스 선택은 미정): Google Drive for desktop은 두 OS의 설치·로그인을 지원한다.
같은 계정의 백업 폴더를 이용하되 기기마다 실제 로컬 경로를 다시 확인한다. tar 묶음/복구 목록은 공통 형식으로 만들고,
다운로드 완료·tar/하드 링크 복원은 각 OS에서 별도 검증한다. Dropbox도 두 OS를 지원하므로 Google Drive 전용으로 고정할 필요는 없다.
공식 안내: [Google Drive 설치](https://support.google.com/drive/answer/10838124?hl=en),
[지원 환경](https://support.google.com/drive/answer/2375082?hl=en), [Dropbox 지원 환경](https://help.dropbox.com/installs/system-requirements).

Google Drive 직접 연결의 세부 후보: 일반 폴더를 앱이 만들고 `drive.file` 범위를 쓰거나,
앱 전용 숨김 공간인 `appDataFolder`를 `drive.appdata` 범위로 사용한다. 두 범위는 공식 문서상 non-sensitive다.
후자는 Drive 화면에서 직접 파일을 꺼낼 수 없고 앱 데이터 삭제 시 사라져, 일반 폴더와 복구 편의가 다르다.
OAuth 앱 등록·기본 검증과 토큰 관리 부담은 남는다. 폴더 연동과 직접 API 연결은 별도 방식이다.

### 하드 링크의 공간 절약 — 후속 검토

2026-11-03 사용자 선호: 현재 하드 링크의 용량 절약 이점을 클라우드에서도 유지하고 싶다.
클라우드 폴더를 전송 수단으로 선택해도 아래 저장 형식을 함께 사용할 수 있다. 방식 선택은 아직 TBD(DC-38)다.

| 저장 형식 | 중복 저장과 전송 | 구현·복구에서 고려할 점 |
| --- | --- | --- |
| 백업별 독립 압축 파일(초기 후보) | 한 백업씩 복구하기 쉽지만 파일을 여러 백업 사이에서 공유하지 않는다. | 백업 수만큼 같은 내용이 들어갈 수 있다. 공간 절약을 우선하는 이번 선호에는 후순위다. |
| 보관 중인 여러 백업을 하드 링크 보존 tar 하나로 묶기 | 같은 inode의 데이터는 그 묶음 안에 한 번 저장된다. 압축을 더할 수도 있다. | 로컬 구조를 활용하는 첫 후보다. 갱신 때 묶음을 다시 만들며 전송량 절약은 보장하지 않는다. 매번 새 묶음을 모두 보관하면 묶음 사이 중복은 남는다. |
| 내용 해시별 공유 파일과 백업별 목록 | 같은 파일 내용은 한 번 저장하고 목록들이 공유한다. 클라우드 폴더에는 새 내용 파일과 목록만 추가할 수 있다. | 복구에 필요한 전체 파일 확인·중단/재실행·공유 데이터 정리 구현이 필요하다. 계속 쌓는 백업에서 저장·전송량 절약을 중시할 때의 후보다. |

tar는 **공유하는 백업들을 한 번의 묶기 작업에 함께 넣을 때** 이점이 있다. 백업마다 따로 tar를 만들면 백업 사이 공유는 남지 않는다.
묶음을 풀 때 링크 대상까지 포함해 검증된 임시 공간에 복원한 뒤 원하는 백업을 고른다. 하드 링크는 같은 복원 공간 안의 검증된 일반 파일만
가리키도록 제한해야 한다. 경로 이탈·심볼릭 링크는 허용하지 않는다. 지원 OS·파일 시스템·아카이브 라이브러리의 링크 보존은 구현 때 검증한다.
기존 파일 시스템이 하드 링크 생성을 지원하지 않아 로컬 백업부터 복사됐다면 tar만으로 내용 중복을 찾아 주지는 않는다.

내용 해시별 공유 저장은 현재 manifest의 `{ path, size, sha256 }`와 파일별 해시 검증을 활용할 수 있다.
예시 구조는 `objects/<sha256>`(파일 내용 한 번), `snapshots/<고유 ID>.json`(경로와 해시 목록)이며 실제 계약은 미정이다.
크기는 대략 **보관하는 백업에 필요한 서로 다른 파일 내용의 합 + 목록·형식 메타데이터**다.
현재 하드 링크와 마찬가지로 파일 전체가 공유 단위라 내용을 조금 고쳐도 새 파일 내용 한 벌이 추가된다. 줄 단위 차이만 저장하는 방식은 아니다.
파일과 목록은 불변으로 만들고, 모든 참조 파일을 다운로드해 크기·해시를 확인하기 전까지 복구 가능으로 표시하지 않는 안을 제안한다.
동기화 폴더에서는 목록이 내용 파일보다 먼저 도착할 수 있다. 초기 원격 자동 삭제 없음 제안을 유지하며,
향후 정리는 모든 보관 목록의 참조와 다른 기기의 지연 전송을 고려해야 한다. 암호화 선택 시 같은 객체의 재사용과 키 이전도 함께 설계한다.
새 컴퓨터의 로컬 저장소에서는 검증된 동일 파일을 하드 링크로 다시 공유하는 방안도 가능하다(파일 시스템이 지원하면).

성숙한 외부 도구를 사용하는 대안으로 restic의 중복 제거·암호화도 검토할 수 있다. 외부 프로그램·저장소·키 관리가 추가되므로 이번에 채택한 것은 아니다.
현재 선호 기준 제안: 변경 범위를 작게 시작하려면 여러 백업의 tar 묶음, 새 내용만 계속 추가하려면 해시별 공유 저장을 먼저 비교한다.

로컬 실험(2026-11-03): 현재 `writeBackup`으로 합성 백업 10개를 만들었다. 바뀌지 않은 65,536바이트 파일은 9번 하드 링크됐고,
설치된 tar로 전체를 묶었다가 풀었을 때 10개 경로가 같은 inode를 공유하며 원본 바이트와 일치했다.
무압축 tar 크기는 백업별 합계 808,960바이트, 전체 묶음 209,920바이트였다(헤더·manifest·변경 파일 포함).
임시 파일은 정리했다. 이 수치는 작은 로컬 예제의 결과이며 실제 클라우드·Windows·전송량이나 일반적인 절약률의 검증은 아니다.
원리 확인: [GNU tar 하드 링크](https://www.gnu.org/software/tar/manual/html_node/hard-links.html),
[restic 저장 구조와 중복 제거](https://restic.readthedocs.io/en/stable/100_references.html).

### npx 용량과 스킬에서 실행하는 대안

2026-11-03 사용자 관심: npx로 실행하는 일반 사용자에게 추가 의존성 비용을 지우는 것이 적절한지 질문했고,
별도 스킬에서 에이전트가 백업의 클라우드 전달을 돕는 방향을 확인했다. 이름·설치·보조 코드의 세부 범위는 미정(DC-40·41)이다.

- 로컬 측정: 현재 docatlas tarball 79,226바이트, 패키지 자체를 풀면 272,358바이트.
  현재 실행 의존성 파일 합계는 4,451,569바이트다(Node.js·개발 의존성·파일 시스템 할당 단위 제외).
  npm에 포함된 tar 7.5.22와 하위 의존성 5개의 파일 합계는 707,224바이트였다. 기능 코드를 더한 0.8~1MB 증가는 설치 후 크기의 초안이다.
  그 사본들을 각각 gzip tar로 묶은 합계는 204,800바이트였다. 실제 npm 배포본 전송량이나 새 캐시에서의 실행 시간 측정은 아니다.
- npx는 npm 캐시를 이용한다. 설치 후 1MB 증가가 실행할 때마다 1MB 다운로드된다는 뜻은 아니다.
  첫 실행 비용은 압축 전송량 외에 의존성 조회·설치에도 영향을 받는다. 기존 캐시가 있는 경우와 없는 경우를 나눠 측정해야 한다.
- 현재 로컬 자동 백업도 에이전트가 명령을 실행하므로, 사용자의 클라우드 작업 요청 때 같은 에이전트가 시스템 tar를 사용하는 방향이다.
  docatlas는 기존 로컬 백업·검증·복구를 맡고 새 스킬은 대상 폴더 선택·tar 묶음 준비·가져오기 절차를 맡는 안을 우선 제안한다.
  이 안은 tar 라이브러리를 런타임 의존성에 추가하지 않는다. kit로 배포하면 스킬·룰 텍스트만큼은 npm 패키지에 추가된다(분량은 작성 뒤 측정).
- 별도 스킬은 선택 설치 후보(default false)다. 이름·의존 스킬·개인 설정 위치는 TBD이며, 기본 설치 항목 변경을 뜻하지 않는다.
  기존 private 스킬과 implementer의 phase 끝 백업 절차에는 클라우드 후속 실행을 연결하지 않는다(DC-42).
  `requires`는 현재 도움말의 의존 안내일 뿐 자동 설치나 자동 실행 기능이 아니다.
- 스킬의 제안 흐름: 기존 명령으로 로컬 백업 → 명령이 알려 준 키/저장 위치에서 검증된 여러 백업을 한 tar로 묶기 →
  완성된 묶음을 개인 설정의 클라우드 폴더에 배치한다. 복구는 임시 공간의 경로·내부 링크·manifest 검증 → 기존 로컬 저장소에 안전하게 가져오기 →
  기존 restore 미리보기 후 복구다. 저장소 밖의 파일을 임의로 덮어쓰거나 원격 정리를 추가하지 않는다.
- OS별 tar 존재·옵션·하드 링크 보존, 실패/중단 처리, 묶음 보관 수와 새 컴퓨터의 설정·키 연결을 절차로 정한다.
  에이전트 세션에서만 동작하며 상시 동기화 기능은 아니다. 폴더 사본 준비를 원격 업로드 완료로 보고하지 않는 조건은 같다.
- 보조 스크립트를 같이 설치하면 재현성을 높일 수 있지만 현재 agent-kit manifest·검사·설치기는 SKILL.md와 룰 파일만 다룬다.
  `scripts/`를 넣어 그대로 배포할 수 있다고 가정하지 않는다. 스크립트가 필요하면 별도 배포 또는 설치 자산 지원을 추가 설계한다.

비교 판단: npx 경량성과 기존 에이전트 중심 사용 흐름에는 스킬 안이 적합하다. 에이전트 없이 항상 같은 동작을 하는 단일 CLI 명령이
필요해지면 CLI 구현 안을 다시 비교한다. `optionalDependencies`는 기본적으로 설치되며, 동적 import도 다운로드를 분리하지 않으므로 선택 설치의 대안으로 보지 않는다.
공식 근거: [npm exec 캐시](https://docs.npmjs.com/cli/v11/commands/npm-exec/#a-note-on-caching),
[npm optionalDependencies](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#optionaldependencies).

### OS 안내와 기존 백업 상태 — RQ-25 검토안

2026-11-03 사용자 요청: 에이전트가 컴퓨터 환경에 맞춰 백업을 권하고 도와주되 이미 백업 중인지 제대로 판단해야 한다.
"이미 연결해 사용하는지", "로컬 백업과 현재 문서가 같은지", "작업이 지금 실행 중인지", "원격 업로드가 끝났는지"를 별개로 다룬다.
이 절은 제안이며 기록 위치·스키마·검사/잠금 코드·배포는 DC-41 TBD다. 현재 제품에 클라우드 상태 기록은 없다.

- 현재 `private status`는 최신 일반 백업 manifest와 현재 파일의 해시를 비교해 `same|changed|none|unknown`을 낸다.
  `private list`는 프로젝트 키·로컬 저장 위치·백업 목록을 알려 준다. 둘 다 클라우드 연결 여부나 원격 업로드 상태를 확인하지 않는다.
  status의 same도 백업의 모든 실제 데이터를 다시 읽어 검증했다는 뜻은 아니다. 복구 전 전체 검증과 구분한다.
  현재 status는 `--key`를 받지 않으므로, 연결 설정에서 이전 키/사용자 지정 키를 쓰면 list의 `--key`와 해당 manifest를 대조해야 한다.
- 안내 순서 제안: 저장된 연결 확인 → 실제 OS·실행 도구·사용자가 연결한 클라우드 폴더 확인 → 기존 연결 재사용 또는 최초 선택 안내.
  OS만으로 서비스를 고정하지 않는다. 설치/로그인/경로가 확인된 사용자의 기존 방식을 먼저 권하며,
  여러 계정·여러 클라이언트이면 저장된 대상이 없는 경우에만 선택을 요청한다. 확인되지 않은 폴더를 만들고 연결 성공으로 보지 않는다.
- 설정은 사용자 홈의 개인 파일 후보에 프로젝트 키·기기 식별자·선택한 방식·사용자가 지정한 경로를 기록한다.
  last verified 결과는 포함한 백업 manifest 집합의 내용 서명·묶음 경로/해시·검증 시각을 후보로 둔다.
  사용자가 요청한 클라우드 관리 작업 진입 시 파일 존재·권한·묶음 완결성/내용을 대조한다. 마지막 실패가 이전의 정상 검증 결과를 지우지 않게 한다.
  기록·경로·시각 하나만으로 성공/실패를 확정하지 않고, 심볼릭 링크·형식 오류·다른 프로젝트 키도 검사한다.

| 확인 결과 | 제안하는 안내/동작 |
| --- | --- |
| 연결 설정과 검증된 묶음이 있고 포함 백업의 내용 서명이 같다 | 기존 방식 사용 중·사본 준비됨. 다시 설정하지 않고 불필요한 묶기 생략. |
| 연결은 유효하고 포함할 백업이 달라졌다 | 클라우드 백업 요청이면 갱신하고, 상태 확인 요청이면 차이만 보고한다. |
| 같은 대상의 작업 잠금과 유효한 소유 작업이 있다 | 작업 실행 중. 중복 실행하지 않는다. |
| 연결 설정은 있지만 대상 경로/묶음을 확인할 수 없다 | 연결 확인 필요 또는 상태 확인 불가. 처음 연결로 바꾸거나 정상 기록을 지우지 않는다. |
| 설정은 없지만 알려진 대상에서 기존 사본을 찾았다 | 기존 백업 발견·연결 미확인. 프로젝트를 대조하고 사용자가 연결을 선택하도록 안내. |
| 연결 설정과 확인 가능한 사본이 없다 | 이 기기에서 미설정. OS/도구를 점검해 처음 설정을 안내한다. 다른 컴퓨터에도 백업이 없다고 단정하지 않는다. |

- 현재 실행 중 표시는 단순한 JSON 필드나 "확인 후 파일 쓰기"로 구현하면 동시에 시작할 수 있다.
  같은 기기/프로젝트/대상의 원자적 잠금 생성과 고유 작업 ID·소유 프로세스 확인을 제안한다. 기록은 임시 파일 뒤 이름 바꾸기로 갱신한다.
  오래된 시각만으로 잠금을 지우지 않는다. 중단된 실행·재사용된 PID·판정 권한 부족은 정해진 복구 규칙 또는 확인 불가로 처리한다.
  다른 기기의 실행까지 로컬 잠금으로 막을 수는 없다. 클라우드의 파일 이름은 기기·고유 묶음 ID로 분리하는 기존 제안을 유지한다.
- 새 컴퓨터에는 기존 기기의 개인 설정·절대 경로가 없다. 클라우드 폴더를 먼저 연결한 뒤 저장소 키와 사본 목록으로 복구 대상을 고른다.
  모든 홈/클라우드를 무차별 검색하지 않고 저장된 대상이나 사용자가 지정한 폴더를 확인한다. origin 없는 프로젝트는 키 연결을 안내한다.
  코드의 origin은 어떤 프로젝트인지 식별할 수 있지만 사용자의 백업 클라우드·계정·폴더를 알려 주지는 않는다.
  설치된 클라우드 앱이 있다는 사실도 백업 위치를 확정하는 근거가 아니다. 접근할 위치/파일의 단서가 없으면 이를 먼저 물어야 한다.
- 동기화 폴더에 완성된 묶음이 있다는 것은 "사본 준비"의 근거다. 실제 원격 업로드/다른 기기 다운로드 완료는 별도 확인이 필요하다.
  provider가 확인 가능한 상태를 제공하지 않으면 원격 상태는 unknown으로 두고 클라우드 앱의 상태 확인을 안내한다.
- 자연어 스킬만으로 매번 같은 검사·원자적 잠금·검증을 보장하기는 어렵다. 스킬은 환경 안내와 선택을 맡고,
  작은 상태 검사/기록 보조 코드가 구조화된 결과를 내는 구성을 권장한다. Node 기본 fs·crypto·프로세스 기능으로 설계할 수 있어 tar 의존성이 필수는 아니다.
  보조 코드를 CLI에 둘지 별도 배포할지는 DC-40·41에서 정한다. 현재 kit는 보조 스크립트를 동반 설치하지 않는다.

검증 후보 M-24는 새 에이전트 세션의 기존 연결 재사용, 중복 실행, 중단 뒤 재개, 경로 단절, 기록과 실제 사본 불일치를 다룬다.
원격 상태 안내 참고: [Google Drive 데스크톱 동기화 상태](https://support.google.com/drive/answer/10838124?hl=en).

새 컴퓨터의 최초 복구 안내 제안(DC-38·41 TBD):

1. 사용자가 "이 프로젝트의 개인 문서를 복구해 줘"라고 요청한다. 해당 에이전트에 백업/복구 스킬이 필요하면 먼저 설치를 안내한다.
2. 저장된 연결 또는 사용자가 지정한 위치가 없으면 "백업해 둔 클라우드나 폴더, 또는 백업 파일 위치를 알려 주세요"라고 묻는다.
   서비스 이름만 알면 그 서비스의 로그인·로컬 폴더 연결을 안내한다. 로그인과 계정 선택은 사용자가 수행하며, 모르는 위치를 임의로 정하지 않는다.
3. 지정한 백업 폴더 안의 작은 복구 목록으로 저장소 키·형식 버전·백업 ID/포함 시점·묶음 상대 경로/해시를 확인하는 안을 제안한다.
   이 목록은 백업과 함께 보관하며 기기별 절대 경로·인증 정보는 담지 않는다. 문서 본문 전체를 받기 전에 필요한 메타데이터만 확인할 수 있다.
   형식·파일 이름·목록과 tar의 완결성 확인은 DC-38에서 정한다. 목록은 발견을 돕는 근거이며 실제 묶음 검증을 대신하지 않는다.
4. 현재 clone의 키와 맞는 사본을 제시하고, 여러 기기/후보나 origin 변경이 있으면 선택을 안내한다. 이전 백업 방식·tar 명령을 사용자가 다시 설명할 필요는 없다.
5. 선택한 묶음 다운로드와 안전한 임시 검증 → 로컬 저장소 가져오기 → 기존 복구 미리보기/확인 → 복구와 git 숨김 → 새 기기의 연결 기록 순서로 진행한다.

전체 백업을 받기 전에도 목록을 읽어 복구를 안내할 수 있지만, 그 목록의 저장 위치에 접근할 수 있다는 전제가 필요하다.
코드만으로 임의의 클라우드 계정에 있는 백업을 발견하는 기능은 이 제안에 없다. 중앙 계정/발견 서비스는 현재 검토 범위 밖이다.

### 명시적 요청에만 실행 — RQ-26/DC-42 확정

- 사용자가 클라우드 백업·복구 또는 해당 설정/점검을 직접 요청한 범위에서만 스킬을 사용한다.
  대화에서 대상이 명확한 요청은 따르되 일반적인 코드 작업이나 로컬 백업 요청을 클라우드 작업으로 확대하지 않는다.
- 스킬 설치·저장된 연결·phase 종료·로컬 백업 완료는 실행이나 권유의 조건이 아니다. 일반 작업에서 클라우드 위치 탐색·상태 확인·리마인더도 추가하지 않는다.
- 요청한 작업에 필요한 위치·계정 선택·기존 파일 충돌만 확인한다. 새 컴퓨터 복구의 위치 질문은 사용자가 복구를 요청한 뒤에 한다.
- 실패한 작업은 결과를 보고하고 끝낸다. 요청한 작업 범위의 제한된 재시도 외에 세션 종료 후 자동 재시도·주기 실행을 만들지 않는다.
- 기존 DC-34 로컬 phase 백업과 기존 로컬 복구 안내는 유지한다. phase 끝에 클라우드 사본까지 만들자는 초기 제안은 폐기했다.
  이미 명시적으로 준비한 파일을 클라우드 앱이 나중에 전송하는 동작은 앱의 동기화 동작이며 에이전트의 신규 백업 실행과 구분한다.

### 집/회사 PC를 번갈아 사용하는 흐름 — 인수 후보 M-26

- 각 PC에서 같은 클라우드 계정의 백업 폴더와 프로젝트 연결을 한 번 설정한다. 경로는 기기별로 저장하며 OS가 같아도 하드코딩하지 않는다.
  이후 사용자가 작업을 마칠 때 클라우드 백업, 다른 기기에서 시작할 때 최신 백업 복구를 요청하는 흐름이다. 전환 자체가 실행 조건은 아니다(DC-42).
- 백업 시 현재 로컬 문서·포함 백업과 클라우드 사본을 확인하고 tar와 복구 목록을 준비한다. 폴더 쓰기 성공만으로 이전 PC의 업로드 완료를 확정하지 않는다.
- 복구 시 해당 프로젝트의 사본 목록·기기·내용·이미 가져온 백업을 대조한다. 같은 사본/같은 내용은 반복 복구를 생략한다.
  다운로드가 끝나지 않았으면 아직 확인 중으로 안내하고 현재 문서는 보존한다. 기기 시각만으로 최신 내용을 정하지 않는다.
- 현재 PC에 백업/복구 이후의 수정이 있거나 두 기기가 서로 다른 내용으로 작업했으면 차이와 선택지를 제시한다.
  현재 restore는 다른 내용의 기존 파일을 conflict로 남긴다. 새 버전으로 갱신할 때도 미리보기·사용자의 덮어쓰기 요청과 복구 전 백업을 유지한다.
  자동 병합·자동 강제 복구·충돌 해소를 위한 무요청 클라우드 백업은 하지 않는다.
- 시각이 비슷한 여러 기기의 사본·현재 PC가 더 앞선 경우·이전 가져오기 후 분기를 구분할 메타데이터는 DC-38·41에서 구체화한다.
  가져온 묶음 ID·다음 백업의 기준 ID와 내용 서명 등을 후보로 두며, 기록만으로 원격에 아직 도착하지 않은 사본까지 알 수 있다고 보장하지 않는다.

### 요청한 클라우드 작업의 공통 흐름(세부 구현 미정)

```text
개인 문서 → 기존 로컬 백업 → 전송용 저장 집합 → 지정한 클라우드 폴더 → 클라우드 앱 전송
새 컴퓨터: 필요한 내용 다운로드 → 검증·로컬 저장소 가져오기 → 기존 복구 미리보기 → 복구
```

1. opt-in으로 개인 설정에 전송 대상을 저장한다. 설정 위치·옵션·명령 이름은 TBD다.
   개인의 클라우드 경로나 토큰을 커밋 대상인 `docatlas.config.json`·`.docatlas/agents.json`에 넣지 않는 방식을 제안한다.
2. 로컬 백업의 하드 링크 공유를 유지하고, 내보낸 저장 집합에 복구에 필요한 내용을 갖춘다.
   사용자 공간 절약 선호에 따라 위의 여러 백업 tar 묶음과 내용 해시별 공유 저장을 먼저 검토한다.
   형식·라이브러리·암호화는 미확정이다. 공유 저장을 택하면 개별 목록 외에 그 목록이 참조하는 내용 파일도 필요하다.
   프로젝트 키·기기 식별자·무작위 사본 ID로 이름 충돌을 피하고, 시각은 표시용으로 사용한다.
   기기별 시계가 다를 수 있으므로 새 컴퓨터에서 선택할 때 시각만으로 최신 내용을 확정하지 않는다.
3. 사용자가 요청한 클라우드 백업에서는 로컬 `backup`을 이용한 뒤 스킬 절차로 설정한 대상에 사본을 준비한다(세부 구현 DC-40 TBD).
   요청 안에서 같은 내용으로 로컬 백업이 unchanged여도
   이전 전송이 실패했거나 처음 클라우드를 연결했다면 다시 전송할 수 있어야 한다.
   로컬 성공·폴더 사본 준비·원격 업로드 확인·실패/대기를 구분한다. 폴더 방식의 결과는 원격 확인 전까지 "사본 준비"다.
   실패해도 로컬 백업을 보존하며, 재시도할 사본이 로컬 10개 정리로 없어지지 않게 별도로 보관한다.
4. 복구는 다운로드 후 임시 공간에서 경로·파일 종류·개수/크기 상한과 manifest 해시를 검증하고,
   검사된 사본을 로컬 저장소에 들여온 뒤 기존 restore를 이용한다. 기존 이름 충돌 시 덮어쓰지 않고 별도 로컬 이름을 배정한다.
   원격 사본 선택과 로컬 이름의 대응 기록, 가져오기 중단·재실행은 설계 시 구체화한다.
   현재 백업 검증은 내용 보존 확인에 재사용할 수 있지만 안전한 압축 해제 검증을 대신하지 않는다.
   tar를 택하면 검증된 묶음 내부의 하드 링크만 재현하고, 해시별 공유 저장이면 선택한 목록의 모든 참조 파일을 검증한다.
   새 컴퓨터에서도 프로젝트의 git 숨김·충돌 보존·미리보기 후 복구 흐름을 유지한다.
5. 원격 보관은 로컬 10개 정리와 분리한다. 첫 버전은 원격 자동 삭제를 하지 않는 안을 제안하며 용량 증가를 안내한다.
   서비스의 동기화 지연·중간 다운로드·오프라인은 임시 상태로 다루고, 미완성 사본을 복구 가능으로 표시하지 않는다.
   폴더 모드는 원격 완료를 직접 확인할 수 없으므로 전송 대기 사본의 정리 조건도 DC-38에서 정한다.
6. 현재 private는 git 제외와 로컬 접근 권한 보호다. 클라우드에 평문을 올리면 개인 계정의 파일 접근 권한을 따르게 된다.
   업로드 전 암호화 여부와 새 컴퓨터에서의 키 복구를 함께 정한다. 로컬 manifest의 절대 root 경로·프로젝트 키·commit 등
   외부로 나갈 메타데이터도 최소화한다. 암호화 키를 같은 백업에 담지 않는 방식을 제안한다.

rclone을 택하면 원격에 없는 파일을 지우지 않는 `copy`를 기본 후보로 삼는다. 원본과 같게 맞추며 삭제도 하는 `sync`와 구분한다.
불변 사본 ID·내용 확인을 함께 써야 같은 이름의 변경까지 막을 수 있다. 암호화 시 crypt의 키를 새 기기에서도 확보해야 한다.
S3 직접 연결을 택하면 `If-None-Match` 조건부 쓰기로 같은 이름의 객체 덮어쓰기를 막는 방안을 검토한다.

공식 문서 확인(2026-11-03): [rclone copy](https://rclone.org/commands/rclone_copy/),
[sync](https://rclone.org/commands/rclone_sync/), [crypt](https://rclone.org/crypt/),
[OneDrive 다운로드 상태](https://support.microsoft.com/en-us/onedrive/save-disk-space-with-onedrive-files-on-demand-for-windows),
[Drive 앱 데이터](https://developers.google.com/workspace/drive/api/guides/appdata),
[Drive 권한 범위](https://developers.google.com/workspace/drive/api/guides/api-specific-auth),
[Desktop OAuth](https://developers.google.com/identity/protocols/oauth2/native-app),
[S3 조건부 쓰기](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html),
[GitHub 저장소 접근 범위](https://docs.github.com/en/repositories/creating-and-managing-repositories/about-repositories).

### 확정 구현 계약 — 2026-11-03

구현 중 사용자 확장(RQ-28/DC-43): --name은 최대 80자의 NFC 이름이며 기본 default다. 같은 origin 안에서도 이름별 연결·상태·원격 폴더를 분리한다.
프로필/클라우드 경로에는 이름의 SHA-256을 한 단계 추가한다. 목록과 묶음에 name과 tags를 기록한다. projects는 프로젝트 키와 백업 이름을 함께 보여 준다.
backup --tag는 명시적 라벨, restore/list --tag는 선택 조건이다. --bundle과 --tag는 함께 쓰지 않는다. 기존 태그가 다른 내용이면 백업을 멈추고 새 태그를 안내한다.
같은 태그가 여러 기기의 동시 실행으로 겹치면 복구는 ID 선택을 요청한다. 태그는 Git 체크아웃이 아닌 백업 선택 정보다.
RQ-29/DC-44: 사용자가 private 내부로 범위를 확인했다. 경로는 `.docatlas/private/` 기준이며 공개 docs/는 대상이 아니다.
backup과 restore 모두 반복 --path를 지원하고 생략하면 전체다. 복구는 원래 위치에 추가·갱신하며 다른 로컬 폴더를 지우지 않는다.
선택한 경로 중 하나라도 현재 내보낼/복구할 스냅샷에 파일이 없으면 누락 경로를 보고하고 중단한다. 과거 스냅샷에는 해당 경로가 없어도 된다.

사용자 구현 승인에 따른 현재 계약이다. 위의 방식 비교·TBD는 검토 이력이며 이 계약으로 구체화했다. 기존 네 스킬/룰의 본문·버전·해시는 유지한다(RQ-27).

- 새 쌍은 `doc-driven-backup-v1` 1.0.0, default false, requires 없음이다. kit는 1.4.0, 패키지는 후속 배포 요청에 따라 0.6.0으로 게시했다.
  기본 세 쌍은 유지하며 `--all`은 다섯 쌍이다. 새 항목만 추가해서 기존 항목의 업데이트 알림을 만들지 않는다.
- 명시적 호출 정책 `agents/openai.yaml`을 새 스킬에 추가한다. manifest 선택 필드 `invocationPolicy: { path, sha256 }`는
  `skills/<name>/agents/openai.yaml`의 단순 policy.allow_implicit_invocation 불리언만 허용한다. Codex 설치에만 `skill-policy` 파일을 더한다.
  원본 검사·해시 검증·기존 설치 보호/롤백을 동일하게 적용한다. 다른 항목에는 동반 파일이나 버전 변경이 없다.
- 새 보조 진입점 `docatlas private-cloud`는 lazy import한다. collector·server·web·기존 private 명령과 기존 스킬은 이 모듈을 부르지 않는다.
  help 외 결과는 JSON 한 개다. 종료 0 완료/미설정/준비, 1 실행 오류, 2 잘못된 인자, 3 사용자 판단/연결/불완전/손상/잠금이다.
- 명령: `connect --directory <동기화 루트> [--name <이름>] [--key <키>]`, `connections`, `status [--name <이름>]`, `projects --directory <루트>`,
  `list [--directory <루트>] [--name <이름>] [--tag <태그>]`, `backup [--name <이름>] [--tag <태그>] [--path <경로> ...]`,
  `restore [--name <이름>] [--tag <태그> | --bundle <id>] [--directory <루트>] [--path <경로> ...] [--apply] [--force]`, `unlock --lock-id <id> [--name <이름>]`, `help`.
  root·key는 관련 작업에 지정한다. connections는 저장된 이름별 연결만 읽는다. restore 기본은 읽기 전용 미리보기이고 --force는 --apply와 명시적 덮어쓰기 요청에만 쓴다.
- 연결은 사용자 홈 `.docatlas/private-cloud/<작업 루트 해시>/<이름 해시>/connection.json`에 root·name·projectKey·keySource·directory·deviceId를 저장한다.
  state.json은 마지막 준비/복구 및 기준 묶음 ID를 기록한다. 파일 0600·폴더 0700, 부모/파일 심볼릭 링크 거부, 임시 파일 뒤 rename 갱신이다.
  연결 경로는 이미 존재하는 폴더를 사용하고 프로젝트 안은 거부한다. 절대 경로는 로컬에만 저장한다.
- 로컬 작업 잠금은 같은 프로필의 원자적 디렉터리 생성과 owner ID/PID다. 다른 실행은 상태를 보고 멈춘다.
  자동 만료/삭제는 없다. unlock은 표시된 ID가 일치하고 소유 프로세스의 종료가 확인된 경우만 허용한다.
- 클라우드 전용 하위 폴더는 `docatlas-backups/<프로젝트 키 해시>/<이름 해시>/<기기 ID>/`다. 묶음/목록 이름은 무작위 UUID로 충돌을 피한다.
  목록에는 format·projectKey·name·tags·selection·deviceId·bundleId·parents·createdAt·currentSnapshot·snapshot 요약·archive 크기/해시를 둔다.
  원래 절대 경로·인증·사용자명은 넣지 않는다. 목록은 내용 검증 전의 발견 자료이며 업로드 완료 증명이 아니다.
- tar 내부에는 manifest.json과 objects/<SHA-256>만 넣어 여러 백업 사이 동일 내용을 한 번 저장한다.
  이는 기존 하드 링크 공유의 공간 이점을 묶음 안에서 표현하는 방식이며, 원격의 여러 tar 사이까지 공유하지는 않는다.
  tar는 OS 도구에 --format=ustar로 맡긴다. 가져오기는 Node에서 제한된 USTAR 헤더/체크섬/경로/종류/중복/크기/참조 해시를 검사한다.
  Windows tar에 한글 홈의 긴 절대 출력 경로를 넘기지 않고, staging을 cwd로 지정한 뒤 상대 출력 경로를 사용한다.
  임의 tar를 OS 명령으로 직접 풀지 않는다. 경로 이탈·심볼릭/하드 링크 엔트리·PAX/GNU 확장은 거부하고 검증한 일반 파일만 기존 로컬 저장 API로 재현한다.
  정상 묶음의 내부 manifest는 최대 2MiB, 전체 64MiB, 최대 10,000 엔트리다. 파일 경로는 Windows에서도 재현 가능한 상대 경로여야 한다.
- backup은 요청 안에서 기존 전체 로컬 backup을 실행하고 최신 최대 10개에서 선택 경로의 파일을 검증·내보낸다. 경로 생략은 전체다.
  로컬 임시 공간에서 tar를 완성/검증한 뒤 클라우드 폴더의 임시 파일 → 고유 이름 → 목록 순으로 배치한다.
  실패해도 로컬 백업과 이전 사본은 보존한다. 같은 목록 집합/정상 사본이면 새 묶음을 만들지 않는다.
- restore 미리보기는 실제 폴더/설정을 쓰지 않는다. --apply에서 검증한 백업들을 로컬 저장소에 가져오고 기존 private restore를 호출한다.
  내용이 다른 기존 파일은 기존 규칙대로 conflict이며 --force 요청은 먼저 before-restore 백업을 만든다. 백업에 없는 현재 파일은 지우지 않는다.
  복구 후에만 기준 묶음 기록을 갱신한다. 로컬에 이미 같은 백업이 있으면 재사용하며 하드 링크 공유는 기존 writeBackup을 이용한다.
- 여러 기기는 parents/기준 묶음 ID로 분기한 머리를 표시한다. 단일 머리는 복구 후보로 권하고 여러 머리는 선택을 요청한다.
  시각만으로 자동 최신을 고르지 않는다. 미완성/손상 자료가 있으면 기본 복구를 보류하고 명시한 사본만 선택 가능하다.
- Google Drive를 포함한 동기화 앱의 설치/계정/완료 상태는 에이전트가 요청한 작업 안에서 안내한다. 보조 명령은 네트워크·로그인을 하지 않는다.
  첫 버전은 기존 로컬 백업처럼 평문이고 암호화는 후속이다. 원격 정리·상시 실행·자동 병합/자동 권유는 없다(DC-42).

검증: M-23~29, 기능/경계 테스트, production tarball로 두 HOME 왕복과 새 항목 설치, 기존 네 쌍 해시 보존을 확인한다.

## 기존 문서 활용과 문서 정비 역할 — RQ-33~37 구현 계약

상태: 2026-11-08 구현·자동/합성 검증 완료. designer 1.3.1·maintainer 1.0.0을 kit 1.5.0에 등록했다. reviewer는 유지한다.
같은 날 PR #5 리뷰 후속(DC-58)으로 두 역할의 문구를 보완했다. 0.8.0 미게시이므로 버전은 그대로 두고 해시만 갱신했다.
기존 `Refs:`·`Files:`는 탐색 단서이며 전체 색인이나 현재 파일 소유 관계가 아니라는 DC-30·45를 유지한다.

### designer의 조건부 탐색 — DC-52

대응: RQ-33, RQ-37 / M-35, M-39.

기존 탐색 항목 안에서 지정 문서 우선과 정보가 부족할 때의 추가 탐색을 두 문장 정도로 보완한다.
실제 추가한 문구는 아래 두 문장이다. 1.3.0 대비 스킬은 +1행/+276바이트, 룰은 기존 항목에 합쳐 +0행/+274바이트다.

> Read user-specified documents first, and skip further document discovery when they establish the existing requirements and design for the requested change; still read the code the change touches. Otherwise, inspect linked documents and documentation near the relevant code.

첫 문구(`without extra discovery`, +224/+222바이트)는 PR #5 리뷰의 합성 비교에서 REQUIREMENTS만 지정한 작업의
코드 읽기까지 생략하게 했다(DC-58). 그래서 생략 대상을 추가 문서 탐색으로 한정했다.
지정 문서로 현재 변경의 계약과 위치가 확인되면 추가 문서 탐색을 요구하지 않고, 변경이 닿는 코드는 계속 읽는다. 부족하면 링크·관련 코드 주변의
문서부터 찾고, 기존 본문 검색도 사용한다. Files가 없다는 이유로 관련 문서가 없다고 결론 내리지 않는다.
적합한 기존 기준 문서에 반영하는 배치 원칙을 유지하고, 매번 전체 탐색·탐색 보고서·확인 질문을 추가하지 않는다.

### 문서 정비 역할과 실행 흐름 — DC-53

대응: RQ-34, RQ-37 / M-36, M-39, M-40.

하나의 정비 스킬과 같은 기준의 서브에이전트용 룰을 제공한다. 별도 조정 에이전트나 상시 작업은 추가하지 않는다.
designer는 이번 작업의 설계·문서 작성, reviewer는 변경 코드 검토, 정비자는 기존 문서의 정확성·연결·구조를 맡는다.

1. 사용자/호출자가 준 문서·기능·저장소 범위와 현재 기준 커밋·미커밋 변경 유무를 확인한다.
2. 범위 안의 문서 목록·제목·링크·ID·경로를 먼저 훑고 후보별로 필요한 원문과 관련 코드를 읽는다.
   저장소 전체 점검은 기능별로 나눠 진행하며 읽지 않은 범위와 접근 불가 자료를 남긴다.
3. 후보의 주장을 실제 구현·테스트·확인 가능한 Git 이력과 대조한다. 날짜와 검색 결과는 단서로만 사용한다.
4. 문제·영향·문서/코드의 경로와 줄 또는 제목 앵커·권장 수정·확인할 질문을 반환한다.
   점검 범위·미확인 범위와 수행한 검증을 함께 적고, 원문 전체나 긴 탐색 로그를 메인에 복사하지 않는다.
5. 기본 점검은 읽기 전용이다. 사용자가 수정을 요청한 항목과 범위가 있으면 DC-55에 따라 적용한다.
   진단 중 검사는 범위가 정해지고 문서화된 것만 실행하며, 추적 파일과 Git 상태를 바꾸지 않아야 한다.
   무시 대상 생성물(예: 이 저장소 `npm run check`의 `src/web/dist/`)은 판정에서 제외한다(DC-58).

요청할 때만 본문을 읽게 하며 designer/implementer/reviewer의 일반 단계에서 자동 호출하지 않는다.
서브에이전트에는 목표·범위·진입 문서·기준만 전달하고 결과를 요약해 회수한다. 직접 스킬 실행도 허용하지만
그 경우 같은 대화의 컨텍스트를 사용한다. 실제 분리 효과는 클라이언트의 서브에이전트 지원에 의존한다.

### 코드와 문서 대조·누락 기록 — DC-54

대응: RQ-35 / M-37.

각 불일치를 문서 오류, 구현 오류 의심, 미구현 계획, 판단 불가로 구분한다. 사용자 최신 의도와 프로젝트 규칙,
확정 요구사항·설계를 기준으로 삼고 코드는 현재 구현 상태의 근거로 읽는다. 구현이 틀렸을 가능성은 질문이나
코드 수정 권고로 반환하고 정비자가 코드를 바꾸거나 요구사항을 구현 수준으로 낮추지 않는다.
테스트 존재와 실제 실행 결과, 과거 테스트 근거와 이번 검증을 구분하며 오래됐다는 이유만으로 수정하지 않는다.

시간 순서도 근거로 쓴다(DC-58). 문서 주장보다 나중에 코드와 테스트가 의도적으로 함께 바뀌었고 그 뒤 주장을
다시 확인한 기록이 없으면 문서 오류 가능성으로 보고하고, 문서 수정안과 확인 질문만 함께 낸다. 나중의 문서나
결정이 주장을 재확인했거나 변경이 실수로 보이면 구현 오류 의심으로 분류한다. 어느 경우도 확인 전에 고치지 않는다.

Refs는 문서 범위와 실제 ID 정의를 대조한다. 형식 도입 전 문서의 기록 부재를 결함으로 단정하지 않고,
과거 단계 소급은 사용자가 요청한 범위에서만 다룬다. Files는 해당 단계·커밋을 식별할 Git 근거가 있을 때만 복원을 제안한다.
같은 파일에 여러 단계가 섞여 단계별 귀속을 입증하지 못하면 미확인으로 남긴다. 현재 코드와 마지막 수정자만으로
과거 변경 파일·종류를 추측하거나 기존 모든 단계를 소급하지 않는다. 삭제·이름 변경 경로가 과거 기록에 남은 것은
그 자체로 오류가 아니며, 현재 코드와의 연결 정보는 진단 결과에서 과거 Files와 구분한다.

### 병합·이동 권고와 적용 경계 — DC-55

대응: RQ-36 / M-38.

중복 주장·서로 다른 기능의 공통 계약·충돌을 근거로 병합/이동 후보를 제안한다. 파일명이 같거나 제목이
비슷하다는 이유만으로 합치지 않는다. 제안에는 원본·대상 위치, 기준 문서, 유지할 결정·ID·이력과 영향받는
링크/명령/예제/설정 경로를 포함한다. 충돌하는 의도와 해결되지 않은 TBD는 사용자 판단 대상으로 남긴다.

적용 요청이 있으면 범위를 확인해 문서만 바꾸고 변경 직전에 근거 문서와 작업 트리 상태를 다시 확인한다.
기존 미커밋 작업과 사용자 결정을 보존하며, 이동 시 상대 링크·앵커·진입점을 갱신한다.
현재 인계는 하나로 유지하고 과거 커밋 안의 경로와 검증 결과를 현재 사실로 재작성하지 않는다.
결과에는 수정한 파일과 검증·미해결 항목을 남긴다. 진단만 요청한 작업을 병합·이동·삭제로 확대하지 않는다.

### 선택 설치와 구현 구성 — DC-56

대응: RQ-34 / M-40.

2026-11-07 사용자 확정: 새 skill/rule 한 쌍을 기본 설치에서 제외한다(`default: false`).
`docatlas agents install`은 기존 기본 세 역할만 설치하고, `--all`은 정비자도 포함하며,
`--only <정비자 항목명>`은 해당 역할을 지정해 설치한다. 설치 여부와 자동 실행 여부는 별도로 다룬다.

2026-11-08 구현 결정: 이름은 `doc-driven-maintainer-v1`, 새 역할 1.0.0·designer 1.3.1·kit 1.5.0으로 정한다.
작은 designer 보완은 패치, 선택 역할 추가는 kit 마이너로 표현했다. 후속 배포 준비는 DC-57의 npm 0.8.0 후보를 따른다.

- 다른 스킬 설치를 필수로 요구하지 않고 정비 기준을 자체 제공한다. Codex에는 기존 invocationPolicy 방식의
  `allow_implicit_invocation: false`를 적용하고 Claude Code의 룰에도 명시적 요청 조건을 적는다.
- designer만 버전을 올리고 이전 해시를 보존한다. 정비자는 새 항목으로 등록하고 kit 버전을 올린다.
  반환은 Scope, Findings, Proposed changes, Questions, Verification으로 짧게 구성한다.
  발견 사항은 문서 오류·구현 오류 의심·계획·판단 불가를 구분하고 근거 위치와 수정 방향을 포함한다.
- 구현 책임은 `agent-kit/skills/`, `agent-kit/agents/`, manifest와 기존 설치 검증이다.
  설치기 확장은 기존 구조로 표현할 수 없을 때만 검토한다. METHOD 두 언어판·README·agent-kit 안내·CHANGELOG는
  실제 구현 후 갱신한다. 수집기·웹 API·지도 편집·새 검색 CLI/MCP·외부 AI 서비스는 이번 범위에 넣지 않는다.

인수는 M-35~40이다. 스킬/룰 파일 검사와 설치 테스트는 에이전트의 실제 행동을 보장하지 않으므로
실제 designer 세션과 독립 정비 서브에이전트의 점검·선택 적용 결과를 별도로 기록한다.

## 결정 체크리스트

### Phase 1 구현 계약

아래 계약으로 수집기를 구현하고 자동 검증 결과를 기록한다.

- 공개 API는 collectProject(root)이며 화면·서버 없이 IndexSnapshot을 반환한다.
- 기본 include는 위 예제를 따르고 패턴은 대소문자 무시·숨김 경로 포함으로 평가한다.
- 우선순위는 고정 제외 → .gitignore → exclude → include다. include로 제외를 우회하지 않는다.
- .gitignore는 Git 유무와 관계없이 중첩 디렉터리별로 읽고, 경로에 대한 대소문자는 구분한다.
  하위 규칙이 상위 파일 제외를 해제할 수 있지만 제외된 부모 디렉터리는 탐색하지 않는다.
- 디렉터리·파일 심볼릭 링크는 수집하지 않는다. 실행 루트의 별칭만 실제 경로로 정규화한다.
- 원본 경로의 구조 그룹과 루트 그룹(.)을 유지한다. docs 생략은 후속 화면의 표현 문제다.
- 문서에는 contentHash를 포함하고 snapshot revision에 반영해 본문만 바뀌어도 구분한다.
- JSON version 1의 필드는 version/include/exclude/groups/redirects다.
  알 수 없는 필드·타입·비정상 상대 경로·glob 오류는 설정 오류로 처리한다.
- 그룹 보정이 수집된 그룹과 일치하지 않으면 경고한다. 코드 설정이나 front matter 메타데이터는 실행·해석하지 않는다.
- 제목과 설명은 CommonMark 구문 트리에서 추출한다. YAML front matter 블록은 건너뛴다.
  그룹 제목의 알려진 문서 종류 접미사는 제거하며 결과가 비면 폴더명을 사용한다.
- 일반 문서 읽기 실패는 해당 문서를 제외하고 경고한다. ignore 파일 읽기 실패는 그 하위 탐색을 중단하고 경고한다.
- 정렬은 locale에 의존하지 않는 원본 상대 경로 순서다. 그룹 안의 문서는 종류 순서를 먼저 적용한다.
- 자동 테스트는 Node 기본 test runner를 사용한다. 라이브러리 API 근거:
  [picomatch](https://github.com/micromatch/picomatch),
  [ignore](https://github.com/kaelzhang/node-ignore),
  [mdast-util-from-markdown](https://github.com/syntax-tree/mdast-util-from-markdown),
  [Node 22 test runner](https://nodejs.org/docs/latest-v22.x/api/test.html).

### Phase 2 구현 계약

- Node HTTP 서버와 브라우저 기본 ES modules·CSS를 사용한다. src/web/의 완성된 정적 자산을
  패키지에 포함하고 설치 대상 프로젝트의 빌드 없이 제공한다.
- CLI는 기본 cwd, --root, --no-open, --help/-h, --version/-v를 지원한다.
  준비된 서버 주소를 출력한 다음 브라우저를 열며, 포그라운드를 유지한다.
- 서버 API는 /api/map과 /api/document?id=원본상대경로다. 수집한 문서 id만 본문을 읽을 수 있다.
  루트 경계·심볼릭 링크·일반 파일 여부를 요청 시 다시 확인한다.
- 정적 자산은 고정 목록만 제공한다. loopback에 바인딩하고 다른 Host·Origin을 거부한다.
- Ctrl+C와 SIGTERM은 이 프로세스의 서버를 닫으며 다른 실행에는 영향을 주지 않는다.
  브라우저 열기 실패는 주소와 안내를 남기고 서버를 유지한다.
- 지도는 구조 그룹과 문서 그룹을 구분한다. 문서 없는 docs 그룹은 화면에서만 투명하게 펼친다.
  화살표는 하위 구조, 카드 본문은 문서 버튼을 펼친다. 문서 선택과 지도 스크롤을 보존한다.
- 이 단계의 본문은 Markdown source로 명시하고 안전한 텍스트로 표시한다.
  제목·표·코드 렌더링과 문서 링크 탐색은 Phase 3에서 완성한다.
- 넓은 화면은 지도/본문 분할, 좁은 화면은 지도와 본문을 전환한다. 기본 버튼으로 키보드 탐색한다.
- HTTP·CLI는 Node test runner, 실제 화면은 개발 전용 Playwright로 검증한다.
  기본 브라우저 열기는 open 패키지에 위임하며 지원 OS별 실검증 범위는 별도로 기록한다.
- 기술 근거: [Node HTTP](https://nodejs.org/docs/latest-v22.x/api/http.html),
  [open](https://github.com/sindresorhus/open),
  [Playwright](https://playwright.dev/docs/test-use-options).

### Phase 3 구현 계약

- 서버에서 markdown-it을 html:false로 렌더링하고 github-slugger로 한글·중복 제목의 앵커를 만든다.
  표·펜스 코드·읽기 전용 작업 체크박스를 지원한다. 원문은 별도 모드로 보존한다.
- 링크의 파일 경로는 원본 문서 디렉터리 기준이며 /로 시작하면 프로젝트 루트 기준이다.
  URL 경로·앵커를 한 번 디코딩하고 실제 파일 경계와 제외 규칙을 확인한다.
- 수집된 Markdown은 같은 뷰어로 이동한다. 디렉터리는 수집된 README로 연결할 수 있다.
  수집 밖 Markdown·없는 파일·차단된 경로는 현재 본문을 유지하며 이유를 안내한다.
  코드·첨부는 내용을 실행하거나 제공하지 않고 상대 경로 표시·복사만 지원한다.
- 외부 http/https 링크는 별도 탭에서 연다. raw HTML은 텍스트로 표시한다.
  이미지는 프로젝트 안의 PNG/JPEG/GIF/WebP/AVIF만 제공하며 SVG·외부 이미지는 안내로 대체한다.
- 이미지 제공은 본문에 등장해 확인한 참조를 등록한 뒤, 요청 시 경계·제외 규칙을 다시 확인한다.
  수집기와 이미지 접근은 같은 고정 제외·ignore 판단 함수를 사용한다.
- /api/document는 markdown/html/headings/references를 제공하며 /api/asset은 등록한 이미지 id만 허용한다.
- 지도와 본문 스크롤을 분리하고 history entry별 지도·펼침·모드·읽기 위치를 현재 탭 메모리에 보존한다.
  직접 문서·앵커 URL, 같은 문서 앵커·목차, 뒤로/앞으로 가기를 지원한다.
- 기본은 읽기 모드이며 원문 전환을 제공한다. 실패·늦은 응답이 현재 선택 본문을 덮어쓰지 않게 한다.
- 기술 근거: [markdown-it](https://markdown-it.github.io/markdown-it/),
  [github-slugger](https://github.com/Flet/github-slugger).

[x]는 채택한 결정, [ ]는 TBD이며 본문은 그 결정을 위한 구체적인 초안이다.
설계 결정을 해소할 때 근거와 대응 검증 결과를 함께 기록한다.
기술 선택은 해당 단계에서 검증하며 일상적인 선택마다 별도 사용자 승인을 요구하지 않는다.

- [x] DC-52: 2026-11-07 요구사항 정리. 지정 문서 우선·부족할 때만 추가 탐색하는 짧은 보완으로 designer의 기존 문서 활용을 높인다.
  기본 컨텍스트·목표 증가 우려 때문에 매 작업 전체 탐색과 별도 보고 절차를 추가하지 않는다. 구현·합성 검증 완료. M-35, M-39.
- [x] DC-53: 문서 정비를 별도 선택 역할로 두고 요청 범위에서 진단한다. 서브에이전트는 후보별 근거를 조사하고
  요약·미확인 범위를 반환해 메인의 읽기 부담을 줄인다. 일반 개발의 자동 호출은 추가하지 않는다. 구현·합성 검증 완료. M-36, M-39, M-40.
- [x] DC-54: 코드를 현재 구현의 근거로 사용하되 문서 오류와 요구사항을 어긴 구현을 구분한다.
  과거 Files는 Git으로 단계 귀속을 입증할 때만 복원하고 근거가 없으면 미확인으로 남긴다. 구현·합성 검증 완료. M-37.
- [x] DC-55: 기본은 읽기 전용 진단·병합/이동 권고이며 요청한 적용 범위만 문서에 반영한다.
  결정·ID·참조·검증 이력과 기존 작업을 보존한다. 구현·합성 검증 완료. M-38.
- [x] DC-56: 2026-11-07 사용자 확정: 정비자는 기본 설치 제외(`default: false`), `--all` 또는
  `--only <정비자 항목명>`으로 설치한다. 기본 세 역할을 유지한다. 이름은 `doc-driven-maintainer-v1`이다.
  2026-11-08 구현 결정: 정비자 1.0.0·designer 1.3.1·kit 1.5.0, 의존성 없음·Codex 명시 호출 정책과
  위 다섯 절 반환 구성을 채택한다. 기존 설치 기능을 재사용해 추가 런타임 부담을 피한다. M-36, M-40.
- [x] DC-57: 2026-11-08 사용자 요청으로 배포 버전 올림과 PR 작성을 진행한다. 선택 역할 신규 추가이므로
  npm 0.8.0 마이너 후보로 준비하고 kit 1.5.0·기존 런타임 의존성은 유지한다. manifest/lockfile·CLI·tarball의
  버전과 release notes를 맞춘 뒤 현재 브랜치를 푸시하고 main 대상 PR을 만든다. 태그·npm 게시와 실제 클라이언트
  인수 통과를 뜻하지 않는다. 검증은 check·Node·설치 통합·pack과 M-41로 기록한다.
  실행: `594c76d`의 0.8.0 metadata/CLI/tarball 일치와 로컬 check·238개·설치 통합 8개를 확인하고 [PR #5](https://github.com/superlucky84/docatlas/pull/5)를 생성했다.
- [x] DC-58: 2026-11-08 사용자가 PR #5 리뷰 권고의 적용을 요청했다(사용자 확정). 0.8.0 미게시이므로 designer 1.3.1·
  maintainer 1.0.0·kit 1.5.0은 그대로 두고 해시만 갱신한다. (a) designer 지정 문서 문장은 추가 문서 탐색만 생략하고
  변경이 닿는 코드는 읽는다. (b) 정비자는 문서 주장보다 나중에 코드·테스트가 의도적으로 바뀌었고 재확인 기록이
  없으면 문서 오류 가능성으로 보고 수정안과 확인 질문을 낸다. (c) 진단 검사는 추적 파일과 Git 상태를 바꾸지 않고 M-36도
  같은 기준으로 판정한다. (d) METHOD 영문의 소문자 문장 시작과 IMPLEMENT 인계의 인계 이력 링크를 고친다.
  근거: 날짜가 있는 Git 이력의 가상 프로젝트에서 수행한 독립 합성 비교(조건당 1회, Claude 모델). 결과는 M-35·37에 있다. M-35, M-36, M-37.

- [x] DC-51: 사용자 버전 올림·커밋·푸시 요청에 따라 새 기능을 담는 0.7.0 마이너 후보로 준비한다.
  kit 1.4.0과 런타임 의존성은 유지한다. a34bc8c main 푸시 뒤 사용자가 태그 푸시·실제 게시 진행을 승인했다.
  macOS/Windows × Node 22/24 CI를 통과한 main 커밋에 v0.7.0을 걸고 기존 publish.yml로 게시한다.
  첫 CI에서 드러난 테스트의 초기 렌더 대기를 보완하며 제품 UI 계약은 바꾸지 않는다. M-20, M-33, M-34.
  실행 완료: fd12146의 네 조합 CI와 태그 게시가 성공했고 npm latest/gitHead/provenance·게시본 실행을 확인했다.

- [x] DC-50: 2026-11-04 사용자 승인. 현재 DOM UI를 esbuild로 번들링·최소화하고 생성 자산만 배포한다.
  빌드 도구는 개발 의존성이며 runtime build와 프레임워크 전환을 추가하지 않는다. 236/48/8 회귀·설치와 실제 pack 감소를 확인했다. M-34.

- [x] DC-45: 2026-11-04 프로토타입 기술 선택. 기존 Refs/Files 형식과 같은 제목 앵커 규칙을 쓰고,
  직접 기록 우선·같은 문서 그룹의 구현 기록 fallback으로 출처를 제한한다. 현재 구현 계약이며 ID 단위 정밀 연결은 후속이다. M-30.
- [ ] DC-46: Related files 버튼·모달 패널·파일별 기록 펼침의 프로토타입을 구현했다.
  사용자에게 실제 페이지를 제공했으며 최종 배치·표시량·수동 UX 수용은 TBD다. PR-11, M-31.
- [x] DC-47: 사용자 요청한 왼쪽 파일명 검색을 기존 본문 검색에 통합하고 출처별 가중치와 일치 경로를 표시했다.
  이름 변경 전 경로도 같은 그룹 범위에서 검색한다. 현재 프로토타입 기술 선택, M-32.
- [x] DC-48: npx 용량 우려를 실제 pack으로 비교하고 추가 런타임 의존성 없이 구현했다.
  측정값은 자체 패키지 기준이며 고정 크기/속도 보장이 아니다. 배포 후보는 DC-51의 0.7.0, 게시 시점은 사용자 단계다. M-33.
- [ ] DC-49: 사용자 요청으로 로컬 Lithent/ftags의 용량 효과를 검토한다. 도입 결정은 TBD이며
  현재 제품/의존성/빌드 계약을 바꾸지 않는다. 초기 로컬 크기 비교는 완료했고 실제 이식본/pack/동작 동등성은 미검증이다.
  번들 최소화와 프레임워크 도입의 효과를 구분한다. M-33.

- [x] DC-01: 독립 저장소와 단일 설치 패키지. 검증: M-11.
- [x] DC-02: JavaScript ES modules, 현재 최소 Node.js 22. 지원 검증: M-12.
- [x] DC-03: 원본 Markdown을 읽고 설치 경로와 대상 루트를 구분. 검증: M-07, M-11, M-15.
- [x] DC-04: Phase 1 구현 계약의 발견·제외·중첩 ignore·계층·경로 id를 채택했다.
  수집기 자동 검증 통과. M-01, M-02, M-09, M-13의 수집 조건.
- [x] DC-05: AST 기반 제목·설명과 JSON version 1의 설정을 채택했다.
  metadata/config 자동 검증 통과. M-02, M-09의 수집 조건.
- [x] DC-06: 900px 기준 분할/전환, 기본 버튼의 키보드 탐색, 지도 상태 보존을 채택했다.
  Chrome 검증 통과. Phase 3에서 본문·모드 위치와 뒤로/앞으로 가기를 구현했다. M-03, M-04, M-12.
- [x] DC-07: Phase 3의 렌더링·앵커·문서/파일/이미지 참조·HTML 정책을 채택했다.
  Node와 Chrome 검증 통과. M-04, M-06, M-13의 해당 흐름.
- [x] DC-08: 사용자 선택으로 포그라운드 실행과 Ctrl+C 종료를 채택한다. 서버별 소유·정리는 Phase 2에서 검증한다. M-08, M-14.
- [x] DC-09: Phase 4 계약의 검색·직렬 갱신·SSE·탭 메모리 상태 보존을 채택한다. Node·Chrome 검증 통과: M-05, M-07, M-10의 해당 흐름.
- [ ] DC-10: 라이선스 MIT·패키지/저장소 docatlas는 확정했고 0.1.0을 배포했다. 최종 지원 OS는 남아 있다. Phase 7 / M-11, M-12.
- [x] DC-12: 사용자 선택은 docatlas 패키지/명령·superlucky84/docatlas 저장소와 MIT다.
  구현·검증 결과는 이름 변경 단계에서 기록한다. 0.1.0은 사용자 배포 완료, 0.2.0과 최종 지원 OS 검증은 별도다. M-08, M-11.
- [x] DC-13: 수집 범위 옵션과 새 설정 파일은 위 0.2.0 계약을 채택한다. 구현/검증은 아래 추가 단계에서 추적한다. M-01, M-07, M-09, M-11, M-13.
- [x] DC-14: 검색 경로는 별도의 트리 위치 탐색 동작으로 제공하며 현재 본문을 보존한다. 구현/검증은 추가 단계에서 추적한다. M-03, M-05, M-07, M-12.
- [x] DC-15: Python·Java 기본 제외와 Windows 점검은 위 계약을 따른다. 실제 Windows 지원 확정은 CI/수동 결과 후 결정한다. M-01, M-07, M-08, M-09, M-11, M-12, M-13.
- [x] DC-16: 2026-10-28 사용자 선택. 스킬·룰 원본은 agent-kit/, 설치는 docatlas 하위 명령, 기본 전역·프로젝트 옵션,
  재실행 갱신, 기본 designer 한 쌍(DC-28로 세 쌍 모두로 변경), 당분간 Confluence 배포 유지. 구현 전. M-16, M-17.
- [x] DC-17: 위 명령 계약대로 명령 이름·옵션·결과 줄·종료 코드(3 추가)·백업 위치를 3단계에서 구현했고, 클라이언트 감지·
  설치 기록 형식·ctxbin 관리 사본 처리·링크 예외는 2단계에서 구현했다. 제거 명령은 범위에 넣지 않았다. M-16.
- [x] DC-18: Codex CLI 0.165.0에서 codex debug prompt-input(모델 호출 없음)으로 모델에 보이는 입력을 관찰했다.
  격리한 HOME·CODEX_HOME에서 프로젝트 스킬은 신뢰와 무관하게 읽고, 프로젝트 룰은 신뢰한 프로젝트에서만 읽는다.
  같은 이름 룰은 프로젝트 것만 보이고, 같은 이름 스킬은 둘 다 보인다. 경고 문구와 codex-trust 경고에 반영했다. M-17.
- [x] DC-19: 2026-10-28 사용자 확인. 공개 저장소와 npm 패키지(MIT)에 스킬·룰 원본을 포함한다. M-16.
- [x] DC-20: 2026-10-28 사용자 선택. docatlas 저장소 하나를 DDD 본거지로 소개하고, 위 RQ-19 계약의 README 순서·
  루트 METHOD.md(영문)·CONTRIBUTING.md·CHANGELOG.md 분리·공개 안내에서 Confluence/ctxbin 사본 설명 제외·이전 인계 정리를 채택했다. M-18.
- [x] DC-21: 2026-10-28 사용자 요청으로 해소. METHOD.ko.md(영어판 기준 번역)와 영문 합성 예제 examples/sample-shop/을 추가하고,
  저장소 루트 docatlas.config.json의 include를 docs/**/*.md로 한정해 이 저장소의 지도에서 예제를 뺀다. M-18.
- [x] DC-22: 2026-10-28 사용자 선택. 프로젝트 적용은 강제 규칙이 아니라 선택지로 안내하고,
  AGENTS.md·CLAUDE.md 권장 예시는 출발점으로 보여 준다. M-18.
- [x] DC-27: 2026-10-28 사용자 선택. 다른 에이전트용 도움말 절, 원본 경로·GitHub 주소 출력, 두 오류 메시지의 안내. 다음 배포. M-16.
- [x] DC-29: 2026-10-30 사용자 선택. 블로그 글의 문서 위치 원칙 중 저장소에 없던 것(코드가 보여 주는 묶음 따르기, 모듈마다 docs/ 두지 않기,
  여러 모듈 기능은 위치 하나, 구조가 불분명하면 에이전트가 제안하고 사람이 결정)을 METHOD 두 언어판과 designer 스킬 1.2.0(kit 1.1.0)에 반영한다.
  0.4.1로 배포한다(2026-10-30 사용자 결정). M-18.
- [x] DC-32: 2026-11-01 사용자 선택. 개인 문서는 `.docatlas/private/<기능>/`(agents.json은 그대로 커밋, git 안이면 실행 위치와 관계없이 저장소 최상위,
  git 밖이면 실행한 폴더, 홈과 그 위는 막음. git 밖의 위쪽 찾기는 같은 날 단순화로 없앴다), git 숨김은 `.git/info/exclude`,
  문서 지도는 별도 Private 그룹으로 항상 표시, 스킬은 designer 위에 얹는 얇은 스킬. M-21.
- [x] DC-33: 2026-11-01 사용자 선택(제안대로). `doc-driven-private-v1`, 명시적 요청에만 사용, 빈 폴더와 백업이 있으면 복구를 먼저 묻는다. M-21.
  같은 날 사용자 변경: 기본 설치가 아니다(default false). `--all`이나 `--only`로 설치하므로 기본 설치와 `--all`이 다시 달라진다.
- [x] DC-34: 2026-11-01 사용자 선택(제안대로). `~/.docatlas/private-backups/<origin 키>/<시각>/`,
  같은 내용은 건너뜀, 모두 보관(2026-11-01 사용자 변경: 최근 3개, 같은 날 다시 10개, `--keep <n>`), 명령으로 백업하고 처음에는 스킬이 고친 뒤 실행
  (같은 날 사용자 변경: 구현 phase마다 에이전트 몫을 마쳤을 때 한 번과 요청 때만), 바뀌지 않은 파일은 하드 링크로 공유(같은 날 사용자 선택),
  origin 없는 키에 경로 구분값(같은 날 사용자 선택), 클라우드 폴더 지정은 후속. M-22.
- [x] DC-35: 2026-11-01 사용자 선택(제안대로). `docatlas private init|status|backup|list|restore|help`, 대화형 입력 없음, restore는 미리보기와 --force. M-22.
- [x] DC-36: 2026-11-01 사용자 선택(제안대로). Private 그룹은 include/exclude 설정과 저장소 .gitignore의 영향을 받지 않는 고정 출처,
  끄는 설정은 후속. 심볼릭 링크·루트 경계 정책은 같다. M-21.
- [x] DC-37: 2026-11-03 구현 승인에 따라 사용자가 지정한 기존 동기화 폴더를 사용한다. 서비스는 사용자가 선택하고 로그인/전송은 설치된 앱이 맡는다.
  연결 경로는 이름별 사용자 홈 설정에만 둔다. rclone·직접 API·별도 Git은 후속이다. M-23, M-24.
- [x] DC-38: 최대 10개 스냅샷의 내용을 중복 제거한 제한 USTAR와 작은 JSON 복구 목록을 사용한다. 프로젝트/이름·기기/UUID·부모 묶음으로 식별한다.
  검증 후 기존 로컬 저장소로 가져오고 원격 사본은 자동 정리하지 않는다. 로컬 준비와 원격 unknown을 구분한다. 세부 명령/종료 코드는 확정 구현 계약을 따른다. M-23, M-26.
- [x] DC-39: 첫 형식은 평문이며 암호화·키 관리는 후속 범위다. 클라우드 목록은 복구에 필요한 키/이름/태그/상대 경로/내용 해시만 포함하고 절대 경로·인증은 제외한다. M-23.
- [x] DC-40: 선택 쌍 doc-driven-backup-v1 1.0.0, kit 1.4.0, 기존 스킬 의존 없음. 기존 네 쌍과 기본 세 쌍은 유지한다.
  외부 의존성 없는 private-cloud 보조 명령과 시스템 tar를 조합하고 새 Codex 정책 파일만 동반 설치한다. M-23, M-25, M-27.
- [x] DC-41: 이름별 connection/state와 원자적 디렉터리 잠금으로 연결·검증 결과·실행 소유자를 기록한다. 실제 사본/해시를 대조하고 중단된 잠금은 ID/프로세스를 확인해 요청 시 해제한다.
  기존 연결을 우선하고 새 PC는 위치 단서와 복구 목록으로 안내한다. 원격 완료를 알 수 없으면 unknown이다. M-24, M-26.
- [x] DC-42: 2026-11-03 사용자 결정(RQ-26). 클라우드 백업·복구는 명시적 요청에만 수행하고 일반 작업에서 권유하지 않는다.
  설정/설치/phase 종료/로컬 백업 완료가 자동 실행 조건이 아니며, 필요한 안내·점검도 요청한 작업 안에서만 한다. M-25.
- [x] DC-43: 구현 중 사용자 요청으로 이름별 백업과 태그/ID 선택을 추가한다. 덮어쓰는 태그나 Git 체크아웃은 하지 않는다. M-28.
- [x] DC-44: 사용자가 `.docatlas/private/` 내부로 범위를 확인했다. 백업·복구 모두 전체/선택을 지원한다. 반복 --path는 선택, 생략은 전체이며 다른 로컬 파일은 삭제하지 않는다. M-29.
- [x] DC-31: 2026-11-01 사용자 결정. npm 게시를 버전 태그의 GitHub Actions(Trusted Publishing, OIDC)로 자동화하고 0.4.2부터 쓴다.
  수동 실행은 dry-run 리허설, 태그 커밋은 main에 있어야 하며 태그와 버전이 같아야 한다. Trusted Publisher 등록과 태그 푸시 시점은 사용자 단계다. M-20.
- [x] DC-30: 2026-11-01 사용자 결정. 구현 계획의 단계마다 Refs와 Files를 둘 다 남기고, 세 스킬·룰에 규칙을 넣으며, 문서부터 갱신한다.
  후속 결정: designer만으로 Refs·Files가 모두 동작하고 implementer·reviewer는 강화 개념이다(위 역할 표).
  후속 결정: Refs·Files는 참고 기록이며 전체 색인이 아니다. 관련 문서를 찾을 때 본문도 검색한다(위 규칙의 성격).
  형식은 위 RQ-20 계약이다. 세 TBD는 같은 날 사용자가 제안대로 정했다: (a) 라벨·kind·none은 문서 언어와 상관없이 영어,
  (b) 기존 단계는 소급하지 않고 새 작업부터, 예제 checkout만 새 형식, (c) docatlas 수집·검색 기능은 별도 후속. M-19.
- [x] DC-28: 2026-10-29 사용자 선택. 기본 설치를 designer·implementer·reviewer 세 쌍 모두로 바꾸고, 도움말의 포함 여부 질문 단계를
  없앤다. 일부만 원하면 --only. --all과 클라이언트 자동 감지는 그대로 둔다(~/.agents의 Codex 감지 포함, 사용자가 유지 선택).
  kit 원본 내용이 같아 kitVersion은 올리지 않는다. 다음 배포. M-16.
- [x] DC-26: 2026-10-28 사용자 선택(기본 대상과 질문 단계는 DC-28로 변경). 기본 설치는 designer 한 쌍 그대로 두고, README 빠른 시작에 --all 안내를,
  agent-kit 안내에 그 이유를, 에이전트용 도움말에 포함 여부를 먼저 묻는 단계를 둔다. 도움말 변경은 다음 배포. M-16.
- [x] DC-25: 2026-10-28 사용자 선택. README는 핵심과 링크만 두고 사용 레퍼런스는 guide/와 agent-kit/README.md로 옮긴다.
  CLI 도움말 링크 변경은 다음 배포(PR #3). M-18.
- [x] DC-24: 2026-10-28 사용자 선택. 기본 exclude에 **/.conda/**를 더하고 다음 배포에 포함한다. M-01, M-09.
- [x] DC-23: 2026-10-28 사용자 설명. 스펙 주도 개발과의 공통점을 인정하고, 중심이 문서와 그 관리라는 철학 차이를
  METHOD 두 언어와 README에 설명한다. M-18.
- [x] DC-11: 프로젝트별 설치와 docmap/ddd-docmap 공통 진입점을 구현하고 설치 검증을 통과했다.
  사용자 선택은 npx docmap / pnpm docmap이며 전역 런처를 추가하지 않는다. M-08, M-11.
- [x] IC-01: picomatch 4.0.7, ignore 7.0.14, mdast-util-from-markdown 2.1.0과
  Node 기본 test runner를 채택했다. 공식 API 확인과 Node 24 자동 검증 통과.
  Phase 4는 Node 22.12.0에서 검증했다. 선언한 하한 22.0과 최종 OS 범위는 배포 전 확정한다. Phase 3 렌더러는 markdown-it 15.0.3, 앵커는 github-slugger 2.0.0이다.
- [x] IC-02: Node HTTP + 기본 DOM/ES modules/CSS로 구현하고 src/web 정적 자산을 패키징한다.
  프레임워크·프로젝트별 빌드가 필요 없다. M-03, M-11.
- [ ] IC-03: open 10.2.0과 SIGINT·SIGTERM 정리는 Phase 2에서 채택·검증했다.
  파일 감지는 chokidar 5.0.0을 채택한다. OS별 최종 지원 범위는 Phase 7의 TBD다. M-07, M-08, M-12.

## 이전 인계 기록

이전 인계와 그 시점의 검증 기록은 [인계 이력](./handoff/HISTORY.md#설계에서-옮긴-기록)으로 옮겼다.
현재 인계는 [구현 계획](./IMPLEMENT.md#현재-인계)에 하나만 둔다.

## DC-15 후속: 플랫폼 CI의 의존성 설치

- npm ci의 lockfile/tarball 캐시와 새 임시 프로젝트 설치에 필요한 packument 캐시를 동일하게 취급하지 않는다.
- test:platform의 최초 production tarball 설치는 --prefer-offline으로 캐시를 우선하고 누락 정보를 registry에서 받는다.
  설치 이후 세 bin의 도움말/버전 검사는 --offline으로 유지한다. 진단에도 설치 모드와 실행 모드를 구분한다.
- test:integration은 사전에 준비한 캐시에서의 엄격한 오프라인 설치를 계속 검증한다.
- CI push/PR의 docs/**만 바뀐 인계 커밋은 플랫폼 재실행을 생략하고 README·코드·테스트·workflow 변경은 실행한다.
  설치·브라우저 검사를 생략해 통과시키지 않는다. Windows 콘솔/브라우저 수동 인수와 자동 CI 결과는 별도다.

검증 근거: 967c175의 [run 40657181408](https://github.com/superlucky84/docatlas/actions/runs/40657181408)에서 macOS/Windows Node 22/24 네 작업이 모두 성공했다.
각 작업의 플랫폼 6개·실제 브라우저 40개·pack 29파일·문법 54개를 로그로 확인했다. Windows의 네이티브 경로와 npm .cmd 실행기도 통과했다.
로컬의 새 캐시 재현은 수정 전 5/6 통과와 ENOTCACHED, 수정 후 6/6 통과다. 다음은 실제 콘솔/기본 브라우저 인수와 별도 배포다.
최신 구현 커밋은 967c175이며 기술적 차단은 없다. Windows 전체 POSIX 기반 테스트나 수동 인수가 완료된 것으로 확대하지 않는다.
