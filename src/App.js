import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import messages from './messages';
import { useMascotState } from './useMascotState';

const BASE = window.location.hostname === 'localhost' ? '' : 'asset://';

const CHARACTER = {
  normal:  `${BASE}assets/character_normal.png`,
  happy:   `${BASE}assets/character_happy.png`,
  sleepy:  `${BASE}assets/character_sleepy.png`,
  excited: `${BASE}assets/character_excited.png`,
  sad:     `${BASE}assets/character_sad.png`,
};

const SIZE_OPTIONS = [
  { label: '소', value: 60 },
  { label: '중', value: 80 },
  { label: '대', value: 100 },
  { label: '특대', value: 120 },
];

function pickMessage(mood) {
  const list = messages[mood];
  return list[Math.floor(Math.random() * list.length)];
}

function todayLabel() {
  const now = new Date();
  return `${now.getFullYear()}년 ${String(now.getMonth() + 1).padStart(2, '0')}월 ${String(now.getDate()).padStart(2, '0')}일`;
}

const api = window.electronAPI;
let nextId = 1;

function adjustColor(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amount));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

export default function App() {
  const [todos, setTodos]               = useState([]);
  const [input, setInput]               = useState('');
  const [lastChecked, setLastChecked]   = useState(null);
  const [expanded, setExpanded]         = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [panelBelow, setPanelBelow]     = useState(false);
  const [saveFolder, setSaveFolder]     = useState(null);
  const [view, setView]                 = useState('todo');
  const [retro, setRetro]               = useState('');
  const [keyColor, setKeyColor]         = useState('#38bdf8');
  const [charSize, setCharSize]         = useState(() => {
    const saved = localStorage.getItem('charSize');
    return saved ? Number(saved) : 80;
  });
  const [contextMenu, setContextMenu]   = useState(null); // {x, y}

  const todosRef    = useRef(todos);
  const retroRef    = useRef(retro);
  const dragStarted = useRef(false);
  const expandDir   = useRef('up');
  useEffect(() => { todosRef.current = todos; }, [todos]);
  useEffect(() => { retroRef.current = retro; }, [retro]);

  const total   = todos.length;
  const checked = todos.filter(t => t.done).length;

  const { mood } = useMascotState({ total, checked, lastChecked });

  const [message, setMessage]           = useState(pickMessage('normal'));
  const [bubbleVisible, setBubbleVisible] = useState(true);
  const [displayMood, setDisplayMood]   = useState('normal');
  const prevMoodRef = useRef('normal');

  useEffect(() => {
    if (mood === prevMoodRef.current) return;
    prevMoodRef.current = mood;
    setBubbleVisible(false);
    const id = setTimeout(() => {
      setMessage(pickMessage(mood));
      setDisplayMood(mood);
      setBubbleVisible(true);
    }, 350);
    return () => { clearTimeout(id); setBubbleVisible(true); };
  }, [mood]);

  // ── CSS 변수로 키컬러 적용 ────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.style.setProperty('--key-color', keyColor);
    document.documentElement.style.setProperty('--key-color-dark', adjustColor(keyColor, -30));
  }, [keyColor]);

  // ── 최초 실행: 저장 폴더 + 키컬러 로드 ──────────────────────────────
  useEffect(() => {
    if (!api) return;
    api.getSaveFolder().then(folder => {
      if (folder) setSaveFolder(folder);
      else api.selectFolder().then(s => { if (s) setSaveFolder(s); });
    });
    api.getKeyColor().then(color => { if (color) setKeyColor(color); });
  }, []);

  // ── 종료 / 자동저장 IPC ──────────────────────────────────────────────
  useEffect(() => {
    if (!api) return;
    api.onRequestSave(() =>
      api.readyToClose({ todos: todosRef.current, retro: retroRef.current })
    );
    api.onRequestAutoSave(() =>
      api.autoSaveData({ todos: todosRef.current, retro: retroRef.current })
    );
    api.onClearCompleted(() => {
      setTodos(prev => prev.filter(t => !t.done));
      setRetro('');
    });
  }, []);

  // ── 컨텍스트 메뉴 닫기 (외부 클릭) ─────────────────────────────────
  useEffect(() => {
    const onDown = () => setContextMenu(null);
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  // ── mouseup 전역: 드래그 종료 ────────────────────────────────────────
  useEffect(() => {
    const onUp = () => {
      if (dragStarted.current) {
        dragStarted.current = false;
        api?.endDrag();
      }
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, []);

  // ── 드래그: startX/Y를 함께 전달해 5px 임계값 이하 이동 무시 ────────
  function handleMascotMouseDown(e) {
    if (e.button !== 0 || !api) return;
    e.preventDefault();
    dragStarted.current = true;
    api.startDrag({ x: e.clientX, y: e.clientY, startX: e.screenX, startY: e.screenY });
  }

  // ── 우클릭: 캐릭터 크기 메뉴 ────────────────────────────────────────
  function handleMascotContextMenu(e) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }

  function selectCharSize(size) {
    setCharSize(size);
    localStorage.setItem('charSize', size);
    setContextMenu(null);
  }

  // ── 더블클릭: 팝업 열기 ──────────────────────────────────────────────
  async function handleMascotDoubleClick() {
    if (!expanded) await open();
  }

  // ── 창 크기 ──────────────────────────────────────────────────────────
  function resizeWindow(expand, direction = 'up') {
    api?.setWindowSize(expand ? 320 : 200, expand ? 470 : 200, direction);
  }

  async function open() {
    // 창 위치 기반으로 팝업을 위/아래 중 공간이 있는 쪽에 표시
    const pos = await api?.getWindowPosition();
    const winY = pos ? pos[1] : 999;
    const below = winY < 300; // 위에 공간이 충분하지 않으면 아래로
    expandDir.current = below ? 'down' : 'up';
    setPanelBelow(below);
    resizeWindow(true, expandDir.current);
    setExpanded(true);
    setTimeout(() => setPanelVisible(true), 50);
  }

  function close() {
    setPanelVisible(false);
    setTimeout(() => {
      setExpanded(false);
      setPanelBelow(false);
      setView('todo');
    }, 310);
    setTimeout(() => resizeWindow(false, expandDir.current), 370);
  }

  async function changeFolder() {
    if (!api) return;
    const selected = await api.selectFolder();
    if (selected) setSaveFolder(selected);
  }

  function handleColorChange(e) {
    const color = e.target.value;
    setKeyColor(color);
    api?.setKeyColor(color);
  }

  // ── Todo CRUD ────────────────────────────────────────────────────────
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

  // ── 렌더 ─────────────────────────────────────────────────────────────
  return (
    <div className={`app-root ${expanded ? 'expanded' : ''} ${panelBelow ? 'panel-below' : ''}`}>

      {expanded && (
        <div className={`todo-panel ${panelVisible ? 'panel-show' : 'panel-hide'}`}>

          {/* ── Todo 뷰 ── */}
          {view === 'todo' && <>
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
              {[...todos]
                .sort((a, b) => a.done - b.done)
                .map(t => (
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
              <div className="footer-actions">
                <button className="retro-btn" onClick={() => setView('retro')}>오늘 회고</button>
                <button className="icon-btn" onClick={changeFolder} title="폴더 변경">📁</button>
                <div className="color-btn" title="색상 변경">
                  🎨
                  <input type="color" value={keyColor} onChange={handleColorChange} />
                </div>
              </div>
            </div>
          </>}

          {/* ── 회고 뷰 ── */}
          {view === 'retro' && <>
            <div className="todo-header">
              <span className="todo-title">오늘 회고</span>
              <button className="close-btn" onClick={() => setView('todo')}>✕</button>
            </div>

            <div className="retro-panel">
              <div className="retro-date">{todayLabel()}</div>
              <textarea
                className="retro-textarea"
                value={retro}
                onChange={e => setRetro(e.target.value)}
                placeholder={"오늘 하루 어땠나요?\n잘 한 것, 아쉬운 것, 내일 할 것들을 자유롭게 적어보세요 ✏️"}
                autoFocus
              />
            </div>

            <div className="retro-footer">
              <button className="save-btn" onClick={() => setView('todo')}>저장하기</button>
            </div>
          </>}

        </div>
      )}

      <div
        className="mascot"
        onMouseDown={handleMascotMouseDown}
        onDoubleClick={handleMascotDoubleClick}
        onContextMenu={handleMascotContextMenu}
      >
        <div className={`speech-bubble ${bubbleVisible ? 'show' : 'hide'}`}>{message}</div>
        <img
          className="mascot-character"
          src={CHARACTER[displayMood]}
          alt="mascot"
          draggable="false"
          style={{ width: charSize, height: charSize }}
        />
      </div>

      {/* ── 캐릭터 크기 컨텍스트 메뉴 ── */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="context-menu-title">캐릭터 크기</div>
          {SIZE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`context-menu-item ${charSize === opt.value ? 'active' : ''}`}
              onClick={() => selectCharSize(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
