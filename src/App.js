import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import messages from './messages';
import { useMascotState } from './useMascotState';

const CHARACTER = {
  normal:  'assets/character_normal.png',
  happy:   'assets/character_happy.png',
  sleepy:  'assets/character_sleepy.png',
  excited: 'assets/character_excited.png',
  sad:     'assets/character_sad.png',
};

function pickMessage(mood) {
  const list = messages[mood];
  return list[Math.floor(Math.random() * list.length)];
}

// 임시 todo 데이터 (나중에 실제 todo 연동으로 교체)
const INITIAL_TODOS = [
  { id: 1, text: '할 일 1', done: false },
  { id: 2, text: '할 일 2', done: false },
  { id: 3, text: '할 일 3', done: false },
];

export default function App() {
  const [todos, setTodos] = useState(INITIAL_TODOS);
  const [lastChecked, setLastChecked] = useState(null);

  const total   = todos.length;
  const checked = todos.filter(t => t.done).length;

  const { mood } = useMascotState({ total, checked, lastChecked });

  // mood 변경 시 fade + 메시지 갱신
  const [message, setMessage]   = useState(pickMessage('normal'));
  const [visible, setVisible]   = useState(true);
  const prevMoodRef              = useRef('normal');

  useEffect(() => {
    if (mood === prevMoodRef.current) return;
    prevMoodRef.current = mood;

    setVisible(false);
    const id = setTimeout(() => {
      setMessage(pickMessage(mood));
      setVisible(true);
    }, 400);
    return () => clearTimeout(id);
  }, [mood]);

  function toggleTodo(id) {
    setTodos(prev =>
      prev.map(t => t.id === id ? { ...t, done: !t.done } : t)
    );
    setLastChecked(Date.now());
  }

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
