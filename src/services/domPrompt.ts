// Android's WebView (the one Capacitor runs the app in) does not implement window.prompt() —
// it returns null immediately without showing anything, so any flow built on window.prompt()
// silently does nothing on a real device. This draws a real HTML input over the canvas instead.
export function domPrompt(message: string, opts: { inputType?: string; placeholder?: string } = {}): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(42,16,70,0.78);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:sans-serif;';

    const box = document.createElement('div');
    box.style.cssText = 'background:#fffaf0;border:3px solid #f5be48;border-radius:20px;padding:24px;width:min(320px,85vw);box-sizing:border-box;';

    const label = document.createElement('div');
    label.textContent = message;
    label.style.cssText = 'color:#3a2317;font-size:16px;margin-bottom:14px;text-align:center;';

    const input = document.createElement('input');
    input.type = opts.inputType ?? 'text';
    input.placeholder = opts.placeholder ?? '';
    input.style.cssText = 'width:100%;box-sizing:border-box;padding:12px;font-size:16px;border:2px solid #cbbfae;border-radius:10px;margin-bottom:16px;';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'flex:1;padding:12px;font-size:15px;border:none;border-radius:10px;background:#8a7c63;color:#fff;font-weight:bold;';

    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.style.cssText = 'flex:1;padding:12px;font-size:15px;border:none;border-radius:10px;background:#ff5ca8;color:#fff;font-weight:bold;';

    const close = (value: string | null) => {
      overlay.remove();
      resolve(value);
    };
    cancelBtn.onclick = () => close(null);
    okBtn.onclick = () => close(input.value.trim());
    input.onkeydown = (e) => {
      if (e.key === 'Enter') close(input.value.trim());
    };

    row.append(cancelBtn, okBtn);
    box.append(label, input, row);
    overlay.append(box);
    document.body.append(overlay);
    setTimeout(() => input.focus(), 50);
  });
}
