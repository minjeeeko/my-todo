import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * 마스코트 상태 머신
 *
 * baseMood  : todo 조건으로 결정되는 지속 상태 (normal / excited / sad)
 * tempMood  : 일시적으로 덮어쓰는 상태 (happy / sleepy)
 * 표시 우선순위: tempMood > baseMood
 *
 * @param {object} params
 * @param {number} params.total       - 전체 todo 수
 * @param {number} params.checked     - 완료된 todo 수
 * @param {number} params.lastChecked - 마지막으로 체크한 timestamp (ms), 없으면 null
 * @returns {{ mood: string, triggerCheck: () => void }}
 */
export function useMascotState({ total, checked, lastChecked }) {
  const [baseMood, setBaseMood] = useState('normal');
  const [tempMood, setTempMood] = useState(null);
  const tempTimerRef = useRef(null);
  const prevCheckedRef = useRef(checked);
  const prevHourRef = useRef(new Date().getHours());

  // 일시 상태 설정 (durationMs 후 자동 해제)
  const setTemp = useCallback((mood, durationMs) => {
    clearTimeout(tempTimerRef.current);
    setTempMood(mood);
    tempTimerRef.current = setTimeout(() => setTempMood(null), durationMs);
  }, []);

  // todo 체크 수 변화 감지 → happy / excited
  useEffect(() => {
    const prev = prevCheckedRef.current;
    prevCheckedRef.current = checked;

    if (checked === prev) return;

    if (total > 0 && checked === total) {
      // 전부 완료 → excited (지속)
      clearTimeout(tempTimerRef.current);
      setTempMood(null);
      setBaseMood('excited');
    } else if (checked > prev) {
      // 하나 체크 → happy 5초
      setTemp('happy', 5000);
      setBaseMood('normal');
    } else {
      // 체크 해제 → excited 해제
      setBaseMood('normal');
    }
  }, [checked, total, setTemp]);

  // sad: 1시간 이상 체크 없음 (todo가 남아 있을 때)
  useEffect(() => {
    if (total === 0 || checked === total) return;

    const check = () => {
      if (lastChecked === null) return;
      const elapsed = Date.now() - lastChecked;
      if (elapsed >= 60 * 60 * 1000) {
        setTemp('sad', 60 * 1000); // sad 1분 표시
      }
    };

    check();
    const id = setInterval(check, 60 * 1000);
    return () => clearInterval(id);
  }, [lastChecked, total, checked, setTemp]);

  // sleepy: 매 분마다 시각 체크 → 14시·15시·16시 정각에 3분간
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const prevH = prevHourRef.current;

      if ([14, 15, 16].includes(h) && m === 0 && h !== prevH) {
        prevHourRef.current = h;
        setTemp('sleepy', 3 * 60 * 1000); // sleepy 3분
      }
    };

    const id = setInterval(check, 30 * 1000);
    return () => clearInterval(id);
  }, [setTemp]);

  return {
    mood: tempMood ?? baseMood,
  };
}
