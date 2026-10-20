export const FRUITS = [
  { id: 'avocado', name: '아보카도', english: 'AVOCADO', icon: '🥑', radii: [0.97, 1.28, 0.92], pear: 0.22, density: 790, color: '#b7d567', juice: '#c2db82', skin: '#293c12', index: 0 },
  { id: 'watermelon', name: '수박', english: 'WATERMELON', icon: '🍉', radii: [1.26, 1.17, 1.14], pear: 0, density: 960, color: '#ee5b67', juice: '#f7757f', skin: '#3e6825', index: 1 },
  { id: 'orange', name: '오렌지', english: 'ORANGE', icon: '🍊', radii: [1.03, 1.01, 1.01], pear: 0.015, density: 890, color: '#ffa93c', juice: '#ffc15c', skin: '#ef851e', index: 2 },
  { id: 'kiwi', name: '키위', english: 'KIWI', icon: '🥝', radii: [0.89, 1.12, 0.88], pear: 0.025, density: 940, color: '#b5dc55', juice: '#c4e969', skin: '#85613d', index: 3 },
  { id: 'lemon', name: '레몬', english: 'LEMON', icon: '🍋', radii: [0.87, 1.19, 0.86], pear: 0, density: 850, color: '#f1dc73', juice: '#f4e9a0', skin: '#e4c93a', index: 4 },
];

export function getFruit(id) {
  return FRUITS.find((fruit) => fruit.id === id) ?? FRUITS[0];
}
