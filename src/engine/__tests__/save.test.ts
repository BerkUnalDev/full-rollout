// src/engine/__tests__/save.test.ts
import { newGame } from '../newGame';
import { endWeek } from '../endWeek';
import { deserialize, serialize } from '../save';

describe('save/load', () => {
  it('roundtrips a fresh and a played state', () => {
    const fresh = newGame(1);
    expect(deserialize(serialize(fresh))).toEqual(fresh);
    const played = endWeek(endWeek(fresh));
    expect(deserialize(serialize(played))).toEqual(played);
  });

  it('rejects corrupt JSON', () => {
    expect(deserialize('{not json')).toBeNull();
    expect(deserialize('')).toBeNull();
    expect(deserialize('{"hello":1}')).toBeNull();
  });

  it('rejects other schema versions', () => {
    const s = newGame(1);
    const tampered = serialize(s).replace('"v":1', '"v":999');
    expect(deserialize(tampered)).toBeNull();
  });
});
