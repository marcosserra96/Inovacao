import { useCallback, useEffect, useRef, useState } from 'react'

/** Comunicação local entre abas do mesmo navegador. Não grava nem altera partidas. */
export type ScreenCommand =
  | {kind:'replay'}
  | {kind:'ranking';hidden:boolean}
  | {kind:'notice';text:string}
export type ScreenCommandMessage=ScreenCommand & {sentAt:number;nonce:string}

const name=(id:string)=>'rota-screen-control:'+id
const valid=(input:unknown):input is ScreenCommandMessage=>{
 if(!input||typeof input!=='object')return false
 const m=input as Record<string,unknown>
 return typeof m.sentAt==='number'&&Date.now()-m.sentAt<15_000&&Date.now()>=m.sentAt-5_000&&
  typeof m.nonce==='string'&&
  (m.kind==='replay'||(m.kind==='ranking'&&typeof m.hidden==='boolean')||
   (m.kind==='notice'&&typeof m.text==='string'&&m.text.length<=180))
}
export function sendScreenCommand(sessionId:string,command:ScreenCommand){
 const message:ScreenCommandMessage={...command,sentAt:Date.now(),nonce:Math.random().toString(36).slice(2)}
 // O evento 'storage' chega às demais abas, e BroadcastChannel reduz latência.
 localStorage.setItem(name(sessionId),JSON.stringify(message))
 try{const channel=new BroadcastChannel(name(sessionId));channel.postMessage(message);channel.close()}catch{/* storage permanece disponível */}
}
export function useScreenControls(sessionId?:string){
 const [hidden,setHidden]=useState(false)
 const [notice,setNotice]=useState('')
 const [replay,setReplay]=useState(0)
 const lastNonce=useRef('')
 const handle=useCallback((input:unknown)=>{
  if(!valid(input)||lastNonce.current===input.nonce)return
  lastNonce.current=input.nonce
  if(input.kind==='replay')setReplay(n=>n+1)
  if(input.kind==='ranking')setHidden(input.hidden)
  if(input.kind==='notice')setNotice(input.text)
 },[])
 useEffect(()=>{
  if(!sessionId)return
  const key=name(sessionId)
  let channel:BroadcastChannel|null=null
  const storage=(e:StorageEvent)=>{if(e.key===key&&e.newValue)try{handle(JSON.parse(e.newValue))}catch{/* ignora dados inválidos */}}
  window.addEventListener('storage',storage)
  try {channel=new BroadcastChannel(key);channel.onmessage=e=>handle(e.data)}catch{/* Safari e browsers restritos usam storage */}
  return()=>{window.removeEventListener('storage',storage);channel?.close()}
 },[sessionId,handle])
 return {hidden,notice,setNotice,replay}
}
