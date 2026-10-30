"""Parse speaker labels without inventing turns, timings or missing participants."""

import re

SPEAKER = re.compile(
    r"^\s*(TEMS[İIıi]LC[İIıi]|M[ÜUüu][ŞSşs]TER[İIıi])\s*:\s*(.*)$", re.IGNORECASE
)


def conversation_turns(content):
    turns = []
    for line in content.splitlines():
        match = SPEAKER.match(line)
        if match:
            speaker = "agent" if match[1].upper().startswith("TEMS") else "customer"
            turns.append({"speaker": speaker, "content": match[2]})
        elif turns:
            turns[-1]["content"] += "\n" + line
        elif line.strip():
            turns.append({"speaker": "unknown", "content": line})
    return [{**turn, "content": turn["content"].strip()} for turn in turns]
