import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import messages from './messages';

const MOODS = ['normal', 'happy', 'sleepy', 'excited', 'sad'];

const CHARACTER = {
  normal:  'assets/character_normal.png',
  happy:   'assets/character_happy.png',
  sleepy:  'assets/character_sleepy.png',
  excited: 'assets/character_excited.png',
  sad:     'assets/character_sad.png',
};

// 30초~2분 사이 랜덤 ms
function randomInterval() {
  return (30 + Math.random() * 90) * 1000;
}

// 현재 시각이 밤 10시~오전 7시인지
function isNightTime() {
  const h = new Date().getHours();
  return h >= 22 || h < 7;
}

// 시간대 가중치를 반영한 다음 상태 선택
function pickNextMood(current) {
  const pool = isNightTime()
    ? [...MOODS, 'sleepy', 'sleepy', 'sleepy'] // sleepy 가중치 4배
    : MOODS;

  let next;
  do {
    next = pool[Math.floor(Math.random() * pool.length)];
  } while (next === current);
  return next;
}

function pickMessage(mood) {
  const list = messages[mood];
  return list[Math.floor(Math.random() * list.length)];
}

function App() {
  const [mood, setMood] = useState('normal');
  const [message, setMessage] = useState(pickMessage('normal'));
  const [visible, setVisible] = useState(true); // fade 제어
  const timerRef = useRef(null);

  useEffect(() => {
    function schedule() {
      timerRef.current = setTimeout(() => {
        const next = pickNextMood(mood);
        // fade out → 상태 전환 → fade in
        setVisible(false);
        setTimeout(() => {
          setMood(next);
          setMessage(pickMessage(next));
          setVisible(true);
          schedule();
        }, 400);
      }, randomInterval());
    }

    schedule();
    return () => clearTimeout(timerRef.current);
  }, [mood]);

  return (
    <div className="mascot">
      <div className={`speech-bubble ${visible ? 'show' : 'hide'}`}>
        {message}
      </div>
      <img
        className={`mascot-character ${visible ? 'show' : 'hide'}`}
        src={CHARACTER[mood]}
        alt="mascot"
      />
    </div>
  );
}

export default App;
