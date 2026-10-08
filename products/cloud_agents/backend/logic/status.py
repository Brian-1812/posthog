"""Map the status of a Tasks run to the public status of a cloud agent run. Pure, no database."""

from __future__ import annotations

from typing import Final

from ..facade.enums import CloudAgentRunStatus, StopReason

TERMINAL_STATUSES: Final = frozenset(
    {CloudAgentRunStatus.COMPLETED, CloudAgentRunStatus.FAILED, CloudAgentRunStatus.CANCELLED}
)

# The `source` that the quota sweep gives to Tasks when it cancels a run. Tasks stores it on the
# run, and it is the only record that the usage limit, and not a person, stopped the run.
QUOTA_SWEEP_CANCEL_SOURCE: Final = "cloud_agents_quota_sweep"

_STATUS_BY_TASK_RUN_STATUS: Final[dict[str, CloudAgentRunStatus]] = {
    "not_started": CloudAgentRunStatus.QUEUED,
    "queued": CloudAgentRunStatus.QUEUED,
    "in_progress": CloudAgentRunStatus.RUNNING,
    "completed": CloudAgentRunStatus.COMPLETED,
    "failed": CloudAgentRunStatus.FAILED,
    "cancelled": CloudAgentRunStatus.CANCELLED,
}

_TASK_RUN_STATUSES_BY_STATUS: Final[dict[CloudAgentRunStatus, tuple[str, ...]]] = {
    status: tuple(task_run_status for task_run_status, mapped in _STATUS_BY_TASK_RUN_STATUS.items() if mapped == status)
    for status in CloudAgentRunStatus
}

_STOP_REASON_BY_RUN_END: Final[dict[str, StopReason]] = {
    "done": StopReason.DONE,
    "cancelled": StopReason.CANCELLED,
    "error": StopReason.ERROR,
    "timeout": StopReason.TIMEOUT,
    "usage_limit": StopReason.USAGE_LIMIT,
}

# The error text of a Tasks run is written for the people who operate Tasks. It can hold an
# exception message or the name of another product, so the API shows one of these messages and
# never the Tasks text.
_ERROR_BY_STOP_REASON: Final[dict[StopReason, str]] = {
    StopReason.ERROR: "The run failed. Send a message to try again, or start a new run.",
    StopReason.TIMEOUT: "The run stopped because it reached its time limit. Send a message to continue.",
    StopReason.USAGE_LIMIT: (
        "The run stopped because this project reached its usage limit. "
        "Raise the limit in billing settings, then send a message to continue."
    ),
    StopReason.BUDGET_EXCEEDED: "The run stopped because it reached its cost limit.",
}


def run_status_for(task_run_status: str) -> CloudAgentRunStatus:
    """The public status of a Tasks run status. Raises `ValueError` for a status that Tasks does not have."""
    try:
        return _STATUS_BY_TASK_RUN_STATUS[task_run_status]
    except KeyError:
        raise ValueError(f"Unknown task run status {task_run_status!r}") from None


def task_run_statuses_for(status: CloudAgentRunStatus) -> tuple[str, ...]:
    """The Tasks run statuses that the API shows as `status`."""
    return _TASK_RUN_STATUSES_BY_STATUS[status]


def stop_reason_for(
    status: CloudAgentRunStatus, run_end: str | None, cancel_source: str | None = None
) -> StopReason | None:
    """Why the run stopped. None while the run is active.

    `run_end` is the Tasks class of the end. `cancel_source` is the source of the cancel request
    that Tasks recorded on the run, if there was one.
    """
    if status not in TERMINAL_STATUSES:
        return None
    if run_end is None:
        raise ValueError("A run that ended needs its end class")
    try:
        stop_reason = _STOP_REASON_BY_RUN_END[run_end]
    except KeyError:
        raise ValueError(f"Unknown run end {run_end!r}") from None
    if stop_reason == StopReason.CANCELLED and cancel_source == QUOTA_SWEEP_CANCEL_SOURCE:
        return StopReason.USAGE_LIMIT
    return stop_reason


def error_message_for(stop_reason: StopReason | None) -> str | None:
    """The message the API shows for a stop reason. None for a run that is active, done or cancelled."""
    return _ERROR_BY_STOP_REASON.get(stop_reason) if stop_reason is not None else None
