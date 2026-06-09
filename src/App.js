import React, { useState } from 'react';
import './App.css';

const STATES = {
  normal:  { image: 'assets/character_normal.png',  message: '안녕하세요!' },
  happy:   { image: 'assets/character_happy.png',   message: '기분 좋아요 😊' },
  sleepy:  { image: 'assets/character_sleepy.png',  message: '졸려요... 😴' },
  excited: { image: 'assets/character_excited.png', message: '신나요!! 🎉' },
  sad:     { image: 'assets/character_sad.png',      message: '슬퍼요... 😢' },
};

function App() {
  const [mood] = useState('normal');
  const { image, message } = STATES[mood];

  return (
    <div className="mascot">
      <div className="speech-bubble">{message}</div>
      <img className="mascot-character" src={image} alt="mascot" />
    </div>
  );
}

export default App;
