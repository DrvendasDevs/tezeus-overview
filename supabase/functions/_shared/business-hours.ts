/**
 * Verifica se o horário atual está dentro do horário de funcionamento do workspace
 * 
 * @param workspaceId - ID do workspace
 * @param supabaseClient - Cliente Supabase
 * @param currentTime - Data/hora atual (opcional, usa Date.now() se não fornecido)
 * @returns true se estiver dentro do horário ou se não houver configuração, false caso contrário
 */
export async function isWithinBusinessHours(
  workspaceId: string,
  supabaseClient: any,
  currentTime?: Date
): Promise<boolean> {
  try {
    // Buscar horários configurados para o workspace
    const { data: businessHours, error } = await supabaseClient
      .from('workspace_business_hours')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_enabled', true);

    if (error) {
      console.error('❌ Erro ao buscar horários de funcionamento:', error);
      // Em caso de erro, permitir envio (fail-safe)
      return true;
    }

    // Se não houver horários configurados, permitir envio (sem restrição)
    if (!businessHours || businessHours.length === 0) {
      console.log('✅ Nenhum horário de funcionamento configurado - permitindo envio');
      return true;
    }

    // Obter data/hora atual no fuso horário America/Sao_Paulo
    const now = currentTime || new Date();
    
    // Converter para fuso horário America/Sao_Paulo usando Intl.DateTimeFormat
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    
    // Obter partes da data formatada
    const parts = formatter.formatToParts(now);
    
    // Converter weekday string para número (0=Domingo, 1=Segunda, etc)
    const weekdayMap: Record<string, number> = {
      'Sunday': 0,
      'Monday': 1,
      'Tuesday': 2,
      'Wednesday': 3,
      'Thursday': 4,
      'Friday': 5,
      'Saturday': 6,
    };
    
    const dayName = parts.find(p => p.type === 'weekday')?.value || '';
    const dayOfWeekNum = weekdayMap[dayName] ?? now.getDay();
    
    // Extrair hora e minuto
    const hours = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    const currentTimeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

    console.log(`🕐 Verificando horário de funcionamento:`, {
      workspaceId,
      dayOfWeek: dayOfWeekNum,
      dayName,
      currentTime: currentTimeString,
      timezone: 'America/Sao_Paulo'
    });

    // Buscar configuração para o dia da semana atual
    const todayConfig = businessHours.find((bh: any) => bh.day_of_week === dayOfWeekNum);

    // ✅ CORREÇÃO: Se não houver configuração para o dia atual, PERMITIR envio
    // Requisito: "Ao não definir horário de funcionamento, entende-se que é qualquer horário"
    // Se o dia não está configurado, significa que não há restrição para esse dia
    if (!todayConfig) {
      console.log(`✅ Dia da semana ${dayOfWeekNum} (${dayName}) não está configurado - permitindo envio (sem restrição para este dia)`);
      return true;
    }

    // Extrair hora e minuto do start_time e end_time
    const startTime = todayConfig.start_time;
    const endTime = todayConfig.end_time;

    // Converter strings TIME para minutos desde meia-noite para comparação
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    
    const startMinutesTotal = startHours * 60 + startMinutes;
    const endMinutesTotal = endHours * 60 + endMinutes;
    const currentMinutesTotal = hours * 60 + minutes;

    console.log(`📊 Comparando horários:`, {
      startTime: `${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}`,
      endTime: `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`,
      currentTime: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      startMinutesTotal,
      endMinutesTotal,
      currentMinutesTotal
    });

    // Verificar se está dentro do horário
    let isWithinHours = false;

    if (endMinutesTotal > startMinutesTotal) {
      // Horário normal (não cruza meia-noite)
      // Ex: 08:00 - 18:00
      isWithinHours = currentMinutesTotal >= startMinutesTotal && currentMinutesTotal <= endMinutesTotal;
    } else {
      // Horário que cruza meia-noite
      // Ex: 22:00 - 02:00 (22:00 até 23:59 e 00:00 até 02:00)
      isWithinHours = currentMinutesTotal >= startMinutesTotal || currentMinutesTotal <= endMinutesTotal;
    }

    if (isWithinHours) {
      console.log('✅ Dentro do horário de funcionamento - permitindo envio');
    } else {
      console.log('🚫 Fora do horário de funcionamento - bloqueando envio');
    }

    return isWithinHours;
  } catch (error) {
    console.error('❌ Erro ao verificar horário de funcionamento:', error);
    // Em caso de erro, permitir envio (fail-safe)
    return true;
  }
}

