'use strict';
const net=require('node:net');
const connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){
 const arg=args[0], opt=typeof arg==='object' && arg!==null?arg:null;
 if (opt?.path || typeof arg==='string' && !/^\d+$/.test(arg)) { throw Error('integration sandbox: IPC and external sockets blocked'); }
 const host=opt?.host ?? opt?.hostname ?? (typeof args[1]==='string'?args[1]:'localhost');
 if (!['127.0.0.1','::1','localhost'].includes(host)) throw Error('integration sandbox: outbound host blocked: '+host);
 return connect.apply(this,args);
};
