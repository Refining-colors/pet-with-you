window.trayMenu.onItems(items=>{
  document.querySelector('#items').replaceChildren(...items.map((item,index)=>{
    if(item.type==='separator')return document.createElement('hr');
    const button=document.createElement('button');button.textContent=item.label;button.onclick=()=>window.trayMenu.choose(index);return button;
  }));
  document.querySelector('button')?.focus();
  window.trayMenu.fit(document.body.getBoundingClientRect().height);
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape')window.trayMenu.close();
  if(!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();
  const items=[...document.querySelectorAll('button')],index=items.indexOf(document.activeElement);
  items[(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();
});
