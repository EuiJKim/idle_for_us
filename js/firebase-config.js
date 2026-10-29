// Firebase 웹 앱 설정. 공개용 식별자이며 접근 제어는 firestore.rules가 담당한다.
export const firebaseConfig = {
  apiKey: 'AIzaSyDV4ZFqjJvn_otEsphLt_uFgdOYTc7s2Vk',
  authDomain: 'idle-69772.firebaseapp.com',
  projectId: 'idle-69772',
  storageBucket: 'idle-69772.firebasestorage.app',
  messagingSenderId: '284751719397',
  appId: '1:284751719397:web:b90ca0876b384d49ff1d0c',
  measurementId: 'G-E8T97G0SZB',
  // 함께 사냥(v138)용 Realtime Database. 콘솔에서 미국(us-central1)에 만들면 이 주소다.
  // 다른 지역에 만들었으면 콘솔 맨 위에 보이는 주소로 바꾼다.
  databaseURL: 'https://idle-69772-default-rtdb.firebaseio.com',
};

export const FIREBASE_SDK_VERSION = '10.12.2';

// 운영자. **비밀이 아니다** — 이 값이 맞는지는 서버(firestore.rules)가 본다.
// 여기 적힌 건 '누구에게 운영자 화면을 보여 줄까'를 정할 뿐이고,
// 남이 이 값을 흉내 내도 서버가 거부한다.
export const ADMIN_UID = 'hUNkOEQQ6XgSb94Ih6PP2sMEkTl2';
