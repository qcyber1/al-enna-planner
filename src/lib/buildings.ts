// مباني جاهزة من غرف + أثاث (مثل مباني العزب الحديثة في سميسمة)
// الغرف المتجاورة تتداخل بسماكة جدار واحد (0.2 م) عشان يصير جدار مشترك واحد.
import type { Opening, PlanElement, RoomType } from '../types/plan';
import { createElement, makeRoom, ROOM_TYPE_LABELS } from './catalog';
import { WALL } from './rooms';

export interface BuildingPreset {
  id: 'izba-house' | 'majlis-annex';
  title: string;
  blurb: string;
  width: number;
  depth: number;
}

export const BUILDING_PRESETS: BuildingPreset[] = [
  { id: 'izba-house', title: 'مبنى عزبة كامل', blurb: 'مجلس كبير، غرفة ألعاب، غرفتين نوم، حمامين، مطبخ ومخزن', width: 20, depth: 12 },
  { id: 'majlis-annex', title: 'مجلس مع حمام ومطبخ', blurb: 'ملحق مجلس مستقل', width: 14, depth: 8 },
];

type R = [RoomType, number, number, number, number, Opening[], Opening[]?, string?];
type F = [PlanElement['kind'], number, number, Partial<PlanElement>?];

const d = (side: Opening['side'], width = 0.9, offset = 0): Opening => ({ side, width, offset });

/** يبني المبنى: (x0,y0) الزاوية العلوية اليسار، والواجهة (الأبواب الرئيسية) للأمام (+y) */
export function buildPreset(id: BuildingPreset['id'], x0: number, y0: number, roof = '#e9e7e2', facade = '#e7dcc6'): PlanElement[] {
  const rooms: R[] = [];
  const furn: F[] = [];
  if (id === 'izba-house') {
    rooms.push(
      ['majlis', 0, 4.8, 10.2, 7.2, [d('front', 1.8)], [d('front', 1.4, -3.3), d('front', 1.4, 3.3), d('left', 1.4)]],
      ['games', 10, 4.8, 5.8, 7.2, [d('front', 1), d('left', 1, 1.5)], [d('front', 1.2, 1.8)]],
      ['kitchen', 15.6, 6.8, 4.4, 5.2, [d('front', 0.9, -0.8)], [d('right', 1.2)]],
      ['bedroom', 0, 0, 5.2, 5, [d('front', 0.9, 1.2)], [d('back', 1.2), d('left', 1)], 'غرفة نوم 1'],
      ['bedroom', 5, 0, 5.2, 5, [d('front', 0.9, -1.2)], [d('back', 1.2)], 'غرفة نوم 2'],
      ['bathroom', 10, 0, 3, 5, [d('front', 0.8, 0.6)], [d('back', 0.6)], 'حمام 1'],
      ['bathroom', 12.8, 0, 3, 5, [d('front', 0.8, -0.6)], [d('back', 0.6)], 'حمام 2'],
      ['store', 15.6, 0, 4.4, 7, [d('front', 0.9)], [d('right', 0.8)]],
    );
    furn.push(
      ['sofa-l', 5.1, 8.4, { width: 9.4, depth: 6.4 }],
      ['tv-unit', 9.65, 8.4, { rotation: 90 }],
      ['coffee-table', 3.6, 8.9],
      ['coffee-table', 6.4, 8.9],
      ['billiard', 12.9, 8.6],
      ['kitchen-counter', 19.45, 9.4, { rotation: 90 }],
      ['bed', 3, 1.35],
      ['wardrobe', 0.55, 3.4, { rotation: 270 }],
      ['bed', 7.3, 1.35],
      ['wardrobe', 9.65, 3.4, { rotation: 90 }],
      ['bath-set', 11.5, 1.1],
      ['bath-set', 14.3, 1.1],
    );
  } else {
    rooms.push(
      ['majlis', 0, 0, 9.2, 8, [d('front', 1.8)], [d('front', 1.4, -3), d('front', 1.4, 3), d('left', 1.4)]],
      ['bathroom', 9, 0, 5, 3.6, [d('left', 0.8, 0.6)], [d('back', 0.6)]],
      ['kitchen', 9, 3.4, 5, 4.6, [d('front', 0.9)], [d('right', 1.2)]],
    );
    furn.push(['sofa-l', 4.6, 4, { width: 8.4, depth: 7.2 }], ['tv-unit', 8.65, 4, { rotation: 90 }], ['coffee-table', 3.6, 4.6], ['coffee-table', 6, 4.6], ['bath-set', 11.9, 1.1], ['kitchen-counter', 13.45, 5.7, { rotation: 90 }]);
  }
  const els: PlanElement[] = rooms.map(([type, x, y, w, dd, doors, windows, name]) =>
    createElement('room', { x: x0 + x + w / 2, y: y0 + y + dd / 2 }, { width: w, depth: dd, name: name ?? ROOM_TYPE_LABELS[type], room: makeRoom(type, doors, windows ?? []), roof, color: facade }),
  );
  for (const [kind, x, y, o] of furn) els.push(createElement(kind, { x: x0 + x, y: y0 + y }, o ?? {}));
  return els;
}

export { WALL };
