import {useEffect,useRef,useState} from 'react';

const prepareEvent='erp:prepare-budget-print';
let generation=0;

// All mounted Budget views share one print action. Preparing a fresh snapshot
// removes every older print stylesheet, even if a browser omitted afterprint.
export function useBudgetPrintSnapshot<T>() {
  const [snapshot,setSnapshot]=useState<T|null>(null),mounted=useRef(true);
  useEffect(()=>{
    mounted.current=true;
    const clear=()=>setSnapshot(null);
    const complete=()=>{generation++;clear();};
    window.addEventListener(prepareEvent,clear);window.addEventListener('afterprint',complete);
    return()=>{mounted.current=false;window.removeEventListener(prepareEvent,clear);window.removeEventListener('afterprint',complete);};
  },[]);
  const print=(value:T,stillCurrent:()=>boolean=()=>true)=>{
    if(!mounted.current||!stillCurrent())return;
    const ticket=++generation;window.dispatchEvent(new Event(prepareEvent));setSnapshot(value);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(mounted.current&&ticket===generation&&stillCurrent())window.print();
    }));
  };
  return [snapshot,setSnapshot,print] as const;
}
