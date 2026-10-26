#!/bin/sh
# This compatibility branch ships its UI in deliverable/; do not overwrite the shared extension branch.
printf '%s\n' '2.4.6 호환판은 deliverable/ ZIP 또는 marinara-2.4.6 브랜치로 가져와 주세요. 공용 extension 브랜치에는 게시하지 않습니다.' >&2
exit 1
