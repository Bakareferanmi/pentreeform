import React,{useLayoutEffect,useRef} from 'react';
import {mountRedesign} from './redesign.js';
export default function App({live=null}){
 const host=useRef(null),view=useRef(null);
 useLayoutEffect(()=>{view.current=mountRedesign(host.current,{live});return()=>{view.current?.destroy();view.current=null}},[]);
 useLayoutEffect(()=>{view.current?.update(live)},[live]);
 return <div ref={host}/>;
}
