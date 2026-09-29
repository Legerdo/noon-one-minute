// Galmuri 비트맵 폰트(OFL). 설계 크기에서만 쓰면 픽셀이 번지지 않는다.
import g7 from 'galmuri/dist/Galmuri7.woff2?url';
import g9 from 'galmuri/dist/Galmuri9.woff2?url';
import g11 from 'galmuri/dist/Galmuri11.woff2?url';
import g11b from 'galmuri/dist/Galmuri11-Bold.woff2?url';
import g14 from 'galmuri/dist/Galmuri14.woff2?url';

export const FONTS = {
  body: { family: 'Galmuri11', size: 12 },
  bold: { family: 'Galmuri11B', size: 12 },
  small: { family: 'Galmuri9', size: 10 },
  tiny: { family: 'Galmuri7', size: 8 },
  big: { family: 'Galmuri14', size: 15 },
} as const;

export type FontKind = keyof typeof FONTS;

export async function loadFonts(): Promise<void> {
  const list: [string, string][] = [
    ['Galmuri7', g7],
    ['Galmuri9', g9],
    ['Galmuri11', g11],
    ['Galmuri11B', g11b],
    ['Galmuri14', g14],
  ];
  await Promise.all(
    list.map(async ([name, url]) => {
      const face = new FontFace(name, `url(${url})`);
      await face.load();
      document.fonts.add(face);
    }),
  );
}
