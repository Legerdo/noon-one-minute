// 대사. 짧게, 다음에 할 일을 알 수 있게.
import type { Line } from '../ui/widgets';

export const STORY: Record<string, Line[]> = {
  f1_intro: [
    { who: '똑딱이', text: '하루! 정신이 들어? 마을이 통째로 멈췄어. 정오 1분 전에.' },
    { who: '하루', text: '…할아버지는?' },
    { who: '똑딱이', text: '대시계를 고치러 꼭대기에 올라가셨어. 그 뒤로 탑 안의 기계들이 녹에 먹혀 날뛰고 있어.' },
    { who: '똑딱이', text: '왼쪽 작업실에 할아버지 공구함이 있을 거야. 맨손으로는 못 올라가. (방향키 이동 · Z 조사 · X 메뉴)' },
  ],
  kit_after: [
    { who: '똑딱이', text: '단검은 빠르고, 버클러는 짧게 들었다 금방 내릴 수 있어.' },
    { who: '똑딱이', text: '싸움에선 장비를 고르는 게 곧 행동이야. 저기 할아버지의 연습 인형으로 먼저 몸을 풀어 보자!' },
  ],
  need_dummy: [
    { who: '똑딱이', text: '잠깐! 무작정 덤비면 위험해. 작업실의 연습 인형과 먼저 한 번 겨뤄 보자. 싸우는 법을 알려 줄게.' },
  ],
  dummy_first: [
    { who: '똑딱이', text: '좋아, 감 잡았지? 이제 복도 위쪽의 태엽 쥐에게 가 보자. 연습 인형은 언제든 다시 상대할 수 있어.' },
  ],
  no_gear: [{ who: '똑딱이', text: '맨손으로는 무리야. 왼쪽 작업실의 공구함부터 챙기자.' }],
  bench_first: [
    { who: '똑딱이', text: '할아버지의 작업대야. 톱니로 장비를 강화하고, 들고 갈 장비를 고르고, 여기까지를 기록할 수 있어.' },
  ],
  sword_after: [{ who: '똑딱이', text: '장검은 휘두르는 동안에도 방어 5로 받아내. 단단한 자세의 적에게도 먹혀.' }],
  after_rat: [{ who: '똑딱이', text: '잘했어! 이 탑의 싸움은 시간 싸움이야. 상대가 무엇을 언제 할지 읽어.' }],
  after_sentry: [{ who: '똑딱이', text: '계단이 열렸어. 위층은 진자가 흔들리는 회랑이야.' }],
  f2_intro: [{ who: '똑딱이', text: '진자 회랑이야… 저 기사, 원래 할아버지가 만든 문지기였는데. 녹이 저렇게 만들었어.' }],
  hammer_after: [
    { who: '똑딱이', text: '무겁지만 한 방이 커. 대신 준비하는 동안 거의 무방비야.' },
    { who: '똑딱이', text: '아, 이거라면 금 간 벽도 부술 수 있겠다! 서쪽 벽을 봐.' },
  ],
  wall_hint: [{ who: '똑딱이', text: '벽에 금이 가 있어. 아주 무거운 걸로 치면 부서질 것 같아.' }],
  after_knight: [{ who: '똑딱이', text: '기사가 지키던 종루 대방패야. 뭐든 막지만 오래 들고 있어야 해. 거대한 공격에 대비하자.' }],
  after_swarm: [{ who: '똑딱이', text: '벌떼가 흩어졌다! 계단으로 가자.' }],
  f3_intro: [{ who: '똑딱이', text: '기관실이야. 녹 냄새가 지독해… 조심해, 하루.' }],
  awl_after: [{ who: '똑딱이', text: '태엽 송곳은 방어를 무시하고 파고들어. 껍질이 단단한 녀석에게 딱이야.' }],
  tonic_after: [{ who: '똑딱이', text: '모래시계 약은 마시는 데 시간이 걸려. 안전한 틈을 계산해서 마셔. 전투마다 횟수가 정해져 있어.' }],
  f3_draft: [{ who: '똑딱이', text: '…어디선가 바람이 새어 나와. 서쪽 벽, 뭔가 이상하지 않아?' }],
  secret_found: [{ who: '똑딱이', text: '숨은 방이다! 할아버지가 비상용으로 뭔가 숨겨 두셨나 봐.' }],
  heart_after: [{ who: '똑딱이', text: '태엽 심장이야. 네 안의 태엽이 더 오래 버틸 거야.' }],
  after_tortoise: [{ who: '똑딱이', text: '껍질이 깨졌어! 위층 계단 앞에 누군가 있어…' }],
  after_hexer: [{ who: '똑딱이', text: '시간 쐐기! 적이 준비하는 행동을 뒤로 밀 수 있어. 꼭대기에서 쓸모가 있을 거야.' }],
  f4_intro: [
    { who: '녹', text: '…돌아가라, 작은 태엽아. 멈춘 시간은 영원히 녹슬지 않는다.' },
    { who: '하루', text: '거짓말. 움직이지 않는 톱니가 제일 먼저 녹슬어. 할아버지가 늘 그러셨어.' },
    { who: '똑딱이', text: '저기 쓰러져 계신 분… 할아버지야! 저 대진자를 멈춰야 깨어나실 거야.' },
  ],
  grandpa: [
    { who: '안내', text: '보름 할아버지는 깊이 잠들어 있다. 붉은 녹이 옷자락을 휘감고 있다.' },
    { who: '똑딱이', text: '대진자를 멈추면 시간이 다시 흐를 거야. 그럼 분명 깨어나실 거야.' },
  ],
  grandpa_awake: [
    { who: '할아버지', text: '하루야, 고맙다. 대진자는 아직 조금 삐걱대지만… 한 번 더 겨뤄 보고 싶다면 말리지 않으마.' },
    { who: '똑딱이', text: '녹슨 대진자와는 몇 번이든 다시 싸울 수 있어. 다른 장비 조합도 시험해 봐!' },
  ],
  boss_pre: [
    { who: '녹', text: '흐르는 시간은 모든 것을 닳게 한다. 나는 그 고통을 멈췄을 뿐.' },
    { who: '하루', text: '닳아도 괜찮아. 그게 살아 있다는 거니까.' },
  ],
  door: [],
  already: [{ who: '똑딱이', text: '이미 비어 있어.' }],
  save_done: [{ who: '안내', text: '여기까지의 여정을 기록했다.' }],
};

export const AFTER_BATTLE: Partial<Record<string, string>> = {
  rat: 'after_rat',
  sentry: 'after_sentry',
  knight: 'after_knight',
  swarm: 'after_swarm',
  tortoise: 'after_tortoise',
  hexer: 'after_hexer',
};

export const AFTER_CHEST: Partial<Record<string, string>> = {
  f1_kit: 'kit_after',
  f1_sword: 'sword_after',
  f2_hammer: 'hammer_after',
  f3_awl: 'awl_after',
  f3_tonic: 'tonic_after',
  f1_secret: 'heart_after',
  f3_secret: 'heart_after',
};
