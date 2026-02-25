function highlightActions(text: string) {
  const actionRegex = /(\[[^\]]+\])/g;
  
  const parts: { text: string; isAction: boolean }[] = [];
  let lastIndex = 0;
  let match;
  
  while ((match = actionRegex.exec(text)) !== null) {
    // Texto antes da ação
    if (match.index > lastIndex) {
      parts.push({ 
        text: text.substring(lastIndex, match.index), 
        isAction: false 
      });
    }
    
    // A ação em si
    parts.push({ 
      text: match[0], 
      isAction: true 
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Texto restante após a última ação
  if (lastIndex < text.length) {
    parts.push({ 
      text: text.substring(lastIndex), 
      isAction: false 
    });
  }
  
  return parts;
}

export function ActionPreviewDisplay({ value }: { value: string }) {
  const parts = highlightActions(value || "");
  
  return (
    <div className="text-sm whitespace-pre-wrap font-mono">
      {parts.map((part, idx) => (
        part.isAction ? (
          <span 
            key={idx} 
            className="bg-blue-600 text-white px-1 rounded inline-block"
          >
            {part.text}
          </span>
        ) : (
          <span key={idx}>{part.text}</span>
        )
      ))}
    </div>
  );
}
