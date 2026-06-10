import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * baseMood : todo 조건 기반 지속 상태 (normal / excited / sad)
 * tempMood : 일시 상태 (happy / sleepy), 우선순위 높음
 *
 * 상태 규칙:
 * - excited : 전체 완료 (total > 0 && undone === 0)
 * - sad(base): 미완료 5개 이상
 * - sad(temp): 1시간 이상 체크 없음 → 1분간
 * - happy    : todo 체크 시 → 5초간
 * - sleepy   : 오후 2·3·4시 정각 → 3분간
 * - normal   : 그 외
 */
export function useMascotState({ total, checked, lastChecked }) {
  const undone = total - checked;

  const [baseMood, setBaseMood] = useState('normal');
  const [tempMood, setTempMood] = useState(null);
  const tempTimerRef  = useRef(null);
  const prevCheckedRef = useRef(checked);
  const prevHourRef   = useRef(new Date().getHours());

  const setTemp = useCallback((mood, durationMs) => {
    clearTimeout(tempTimerRef.current);
    setTempMood(mood);
    tempTimerRef.current = setTimeout(() => setTempMood(null), durationMs);
  }, []);

  // baseMood: 미완료 수에 따라 결정
  useEffect(() => {
    if (total > 0 && undone === 0) {
      setBaseMood('excited');
    } else if (undone >= 5) {
      setBaseMood('sad');
    } else {
      setBaseMood('normal');
    }
  }, [total, undone]);

  // happy: todo 새로 체크할 때 (전부 완료 시엔 excited로 처리되므로 제외)
  useEffect(() => {
    const prev = prevCheckedRef.current;
    prevCheckedRef.current = checked;

    if (checked > prev && undone > 0) {
      setTemp('happy', 5000);
    }
  }, [checked, undone, setTemp]);

  // sad(temp): 1시간 이상 체크 없음
  useEffect(() => {
    if (total === 0 || undone === 0) return;

    const check = () => {
      if (lastChecked === null) return;
      if (Date.now() - lastChecked >= 60 * 60 * 1000) {
        setTemp('sad', 60 * 1000);
      }
    };

    check();
    const id = setInterval(check, 60 * 1000);
    return () => clearInterval(id);
  }, [lastChecked, total, undone, setTemp]);

  // sleepy: 오후 2·3·4시 정각
  useEffect(() => {
    const check = () => {
      const h = new Date().getHours();
      const m = new Date().getMinutes();
      if ([14, 15, 16].includes(h) && m === 0 && h !== prevHourRef.current) {
        prevHourRef.current = h;
        setTemp('sleepy', 60 * 1000);
      }
    };

    const id = setInterval(check, 30 * 1000);
    return () => clearInterval(id);
  }, [setTemp]);

  return { mood: tempMood ?? baseMood };
}
