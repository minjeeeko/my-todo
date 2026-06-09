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

const api = window.electronAPI;
let nextId = 1;

export default function App() {
  const [todos, setTodos]               = useState([]);
  const [input, setInput]               = useState('');
  const [lastChecked, setLastChecked]   = useState(null);
  const [expanded, setExpanded]         = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [saveFolder, setSaveFolder]     = useState(null);

  const todosRef  = useRef(todos);
  const isDragging = useRef(false);
  useEffect(() => { todosRef.current = todos; }, [todos]);

  const total   = todos.length;
  const checked = todos.filter(t => t.done).length;

  const { mood } = useMascotState({ total, checked, lastChecked });

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

  // ── 최초 실행: 저장 폴더 확인 ──────────────────────────────────────
  useEffect(() => {
    if (!api) return;
    api.getSaveFolder().then(folder => {
      if (folder) setSaveFolder(folder);
      else api.selectFolder().then(s => { if (s) setSaveFolder(s); });
    });
  }, []);

  // ── 종료 시 저장 ────────────────────────────────────────────────────
  useEffect(() => {
    if (!api) return;
    api.onRequestSave(() => api.readyToClose(todosRef.current));
  }, []);

  // ── mouseup 전역: 드래그 종료 ───────────────────────────────────────
  useEffect(() => {
    const onUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        api?.endDrag();
      }
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, []);

  // ── 마스코트 드래그 시작 ─────────────────────────────────────────────
  async function handleMascotMouseDown(e) {
    if (e.button !== 0 || !api) return;
    e.preventDefault();

    const pos = await api.getWindowPosition(); // [x, y]
    const offset = { x: e.screenX - pos[0], y: e.screenY - pos[1] };
    isDragging.current = true;
    api.startDrag(offset);
  }

  // mouseup이 드래그 후 click으로 이어지지 않도록: 드래그 여부로 open 차단
  function handleMascotClick(e) {
    if (isDragging.current) return;
    if (!expanded) open();
  }

  // ── 창 크기 IPC ─────────────────────────────────────────────────────
  function resizeWindow(expand) {
    api?.setWindowSize(expand ? 320 : 200, expand ? 480 : 200);
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

  async function changeFolder() {
    if (!api) return;
    const selected = await api.selectFolder();
    if (selected) setSaveFolder(selected);
  }

  // ── Todo CRUD ───────────────────────────────────────────────────────
  function addTodo() {
    const text = input.trim();
    if (!text) return;
    setTodos(prev => [...prev, { id: nextId++, text, done: false }]);
    setInput('');
  }

  function toggleTodo(id) {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
    setLastChecked(Date.now());
  }

  function deleteTodo(id) {
    setTodos(prev => prev.filter(t => t.id !== id));
  }

  // ── 렌더 ────────────────────────────────────────────────────────────
  return (
    <div className={`app-root ${expanded ? 'expanded' : ''}`}>

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
            <span className="footer-count">완료 {checked}개 / 전체 {total}개</span>
            <button className="folder-btn" onClick={changeFolder}>저장 폴더 변경</button>
          </div>
        </div>
      )}

      <div
        className="mascot"
        onMouseDown={handleMascotMouseDown}
        onClick={handleMascotClick}
      >
        <div className={`speech-bubble ${visible ? 'show' : 'hide'}`}>{message}</div>
        <img
          className={`mascot-character ${visible ? 'show' : 'hide'}`}
          src={CHARACTER[mood]}
          alt="mascot"
          draggable="false"
        />
      </div>
    </div>
  );
}
