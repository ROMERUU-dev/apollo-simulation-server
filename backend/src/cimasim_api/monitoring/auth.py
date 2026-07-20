from __future__ import annotations

import stat
from pathlib import Path
from typing import Annotated

from fastapi import Depends

from cimasim_api.auth.dependencies import authenticated_identity
from cimasim_api.config import Settings, get_app_settings
from cimasim_api.errors import ForbiddenError
from cimasim_api.models import Identity


def _read_allowlist(path: Path | None) -> frozenset[str]:
    if path is None:
        return frozenset()
    try:
        info = path.stat(follow_symlinks=False)
        if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077:
            return frozenset()
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        return frozenset()
    return frozenset(line.strip().lower() for line in text.splitlines() if line.strip())


def administrative_identity(
    identity: Annotated[Identity, Depends(authenticated_identity)],
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> Identity:
    allowlist = _read_allowlist(settings.admin_email_allowlist_file)
    if identity.email.strip().lower() not in allowlist:
        raise ForbiddenError
    return identity
