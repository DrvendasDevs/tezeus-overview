import { useEffect, useRef, useCallback } from 'react';

export const useNotificationSound = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const isEnabledRef = useRef(true);

  useEffect(() => {
    // Criar AudioContext apenas uma vez
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  const playNotificationSound = useCallback(() => {
    if (!isEnabledRef.current || !audioContextRef.current) return;

    try {
      const audioContext = audioContextRef.current;
      const currentTime = audioContext.currentTime;

      // Criar oscilador para o primeiro tom (mais agudo)
      const oscillator1 = audioContext.createOscillator();
      const gainNode1 = audioContext.createGain();
      
      oscillator1.type = 'sine';
      oscillator1.frequency.setValueAtTime(800, currentTime); // Nota mais aguda
      
      gainNode1.gain.setValueAtTime(0, currentTime);
      gainNode1.gain.linearRampToValueAtTime(0.3, currentTime + 0.01);
      gainNode1.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.3);
      
      oscillator1.connect(gainNode1);
      gainNode1.connect(audioContext.destination);
      
      oscillator1.start(currentTime);
      oscillator1.stop(currentTime + 0.3);

      // Criar oscilador para o segundo tom (mais grave) - ligeiramente atrasado
      const oscillator2 = audioContext.createOscillator();
      const gainNode2 = audioContext.createGain();
      
      oscillator2.type = 'sine';
      oscillator2.frequency.setValueAtTime(600, currentTime + 0.1); // Nota mais grave
      
      gainNode2.gain.setValueAtTime(0, currentTime + 0.1);
      gainNode2.gain.linearRampToValueAtTime(0.25, currentTime + 0.11);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.4);
      
      oscillator2.connect(gainNode2);
      gainNode2.connect(audioContext.destination);
      
      oscillator2.start(currentTime + 0.1);
      oscillator2.stop(currentTime + 0.4);
      
      console.log('🔊 Som de notificação tocado');
    } catch (error) {
      console.log('Erro ao tocar som de notificação:', error);
    }
  }, []);

  const toggleSound = useCallback(() => {
    isEnabledRef.current = !isEnabledRef.current;
    return isEnabledRef.current;
  }, []);

  return { playNotificationSound, toggleSound };
};