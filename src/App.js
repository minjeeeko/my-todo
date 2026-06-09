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

let nextId = 1;

export default function App() {
  const [todos, setTodos]           = useState([]);
  const [input, setInput]           = useState('');
  const [lastChecked, setLastChecked] = useState(null);
  const [expanded, setExpanded]     = useState(false);
  const [panelVisible, setPanelVisible] = useState(false); // 패널 fade 제어

  const total   = todos.length;
  const checked = todos.filter(t => t.done).length;

  const { mood } = useMascotState({ total, checked, lastChecked });

  // mood 변경 시 캐릭터/말풍선 fade 전환
  const [message, setMessage] = useState(pickMessage('normal'));
  const [visible, setVisible] = useState(true);
  const prevMoodRef = useRef('normal');

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

  // 창 크기 조절 (IPC)
  function resizeWindow(expand) {
    if (window.electronAPI) {
      window.electronAPI.setWindowSize(
        expand ? 320 : 200,
        expand ? 480 : 200
      );
    }
  }

  function open() {
    resizeWindow(true);
    setExpanded(true);
    setTimeout(() => setPanelVisible(true), 50);
  }

  function close() {
    setPanelVisible(false);
    setTimeout(() => {
      setExpanded(false);
      resizeWindow(false);
    }, 300);
  }

  // 할일 추가
  function addTodo() {
    const text = input.trim();
    if (!text) return;
    setTodos(prev => [...prev, { id: nextId++, text, done: false }]);
    setInput('');
  }

  // 체크 토글
  function toggleTodo(id) {
    setTodos(prev =>
      prev.map(t => t.id === id ? { ...t, done: !t.done } : t)
    );
    setLastChecked(Date.now());
  }

  // 삭제
  function deleteTodo(id) {
    setTodos(prev => prev.filter(t => t.id !== id));
  }

  return (
    <div className={`app-root ${expanded ? 'expanded' : ''}`}>

      {/* 할일 패널 (확장 시) */}
      {expanded && (
        <div className={`todo-panel ${panelVisible ? 'panel-show' : 'panel-hide'}`}>
          <div className="todo-header">
            <span className="todo-title">나의 할 일</span>
            <button className="close-btn" onClick={close}>✕</button>
          </div>

          <div className="todo-input-row">
            <input
              className="todo-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTodo()}
              placeholder="할 일을 입력하세요"
              autoFocus
            />
            <button className="add-btn" onClick={addTodo}>+</button>
          </div>

          <ul className="todo-list">
            {todos.length === 0 && (
              <li className="todo-empty">할 일을 추가해보세요!</li>
            )}
            {todos.map(t => (
              <li key={t.id} className={`todo-item ${t.done ? 'done' : ''}`}>
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => toggleTodo(t.id)}
                  className="todo-checkbox"
                />
                <span className="todo-text">{t.text}</span>
                <button className="delete-btn" onClick={() => deleteTodo(t.id)}>×</button>
              </li>
            ))}
          </ul>

          <div className="todo-footer">
            완료 {checked}개 / 전체 {total}개
          </div>
        </div>
      )}

      {/* 마스코트 영역 */}
      <div className="mascot" onClick={!expanded ? open : undefined}>
        <div className={`speech-bubble ${visible ? 'show' : 'hide'}`}>
          {message}
        </div>
        <img
          className={`mascot-character ${visible ? 'show' : 'hide'}`}
          src={CHARACTER[mood]}
          alt="mascot"
        />
      </div>
    </div>
  );
}
