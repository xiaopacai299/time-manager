export function encodeSyncCursor(updatedAtIso: string, id: string): string {
  return Buffer.from(JSON.stringify({ u: updatedAtIso, i: id }), 'utf8').toString(
    'base64url',
  );
}

export function decodeSyncCursor(cursor: string): { u: string; i: string } {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const j = JSON.parse(raw) as { u?: unknown; i?: unknown };
    if (typeof j.u !== 'string' || typeof j.i !== 'string') {
      throw new Error('bad shape');
    }
    return { u: j.u, i: j.i };
  } catch {
    throw new Error('invalid_sync_cursor');
  }
}
