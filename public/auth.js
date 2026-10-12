(function () {
  'use strict';
  const e=window.FoodLoopCore.escapeHTML;
  const UI=window.FoodLoopUI;
  const $=s=>document.querySelector(s);
  const state={user:null,ready:false,available:false,googleClientId:null,busy:false};
  let googleScript;
  function active(){return ['account','login','signup'].includes(location.hash.slice(1))&&!$('#intro-dialog').open;}
  async function api(action,body) {
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
    try {
      const response=await fetch('/api/auth/'+action,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:body?{'content-type':'application/json','x-foodloop-request':'1'}:{},body:body?JSON.stringify(body):undefined});
      let data;try {data=await response.json();}catch{throw new Error('Accounts are temporarily unavailable. Please try again later.');}
      if (!response.ok) {const error=new Error(data.error||'Sign-in failed. Please try again.');error.code=data.code;throw error;}
      return data;
    } finally {clearTimeout(timeout);}
  }
  function updateButton(){
    const name=state.user?state.user.name.split(/\s+/)[0].slice(0,12):'Sign in';
    $('#account-button-text').textContent=name;
    $('#account-button').setAttribute('aria-label',state.user?'Your FoodLoop account, '+state.user.name:'Sign in or create a FoodLoop account');
  }
  function status(message,error=false){const node=$('#auth-status');if(node){node.textContent=message;node.classList.toggle('auth-error',error);}}
  function googlePlaceholder(){
    return '<div class="google-button-mount" id="google-button-mount">'+(state.googleClientId?'<p class="small muted">Loading Google sign-in…</p>':'<button class="google-unavailable" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12h-8m8 0a8 8 0 1 1-2-5"/></svg>Continue with Google</button><p class="google-notice">Google sign-in is not connected yet. Email accounts are available now.</p>')+'</div>';
  }
  function render(mode='account'){
    if (!state.ready) {UI.setPanel('<p class="dialog-eyebrow">YOUR CAMPUS ACCOUNT.</p><h2 id="dialog-title">A little moment…</h2><p class="dialog-intro">Checking account access.</p>','account');return;}
    if (!state.available) {UI.setPanel('<p class="dialog-eyebrow">YOUR CAMPUS ACCOUNT.</p><h2 id="dialog-title">FoodLoop accounts.</h2><p class="dialog-intro">Open the live website to sign in or create an account. This offline preview lets you explore the cafeteria as a guest.</p><button class="dark-button" data-action="browse-menu">Explore as a guest ↗</button>','account');return;}
    if (state.user){
      const user=state.user;
      UI.setPanel('<p class="dialog-eyebrow">A LITTLE MORE YOU.</p><h2 id="dialog-title">Hi, '+e(user.name.split(/\s+/)[0])+'.</h2><p class="dialog-intro">You’re signed in to your FoodLoop account.</p><div class="account-profile"><div class="account-avatar">'+e(user.name.charAt(0).toUpperCase())+'</div><div><h3>'+e(user.name)+'</h3><p>'+e(user.email)+'</p><span class="outline-tag">'+(user.googleLinked?'Google connected':'Email account')+'</span></div></div><p class="small muted auth-local-note">Cafeteria orders are still a demo. Basket, tracking and feedback stay in this browser and are not synced across devices.</p>'+(!user.googleLinked?'<h3 class="account-link-title">Add Google sign-in.</h3>'+googlePlaceholder():'')+'<div class="account-actions"><button class="dark-button" data-action="orders">Your demo orders ↗</button><button class="outline-button" data-auth-action="logout">Sign out</button></div><p id="auth-status" class="auth-status" role="status"></p>','account');
      if(!user.googleLinked&&state.googleClientId) prepareGoogle(true);return;
    }
    const signup=mode==='signup';
    UI.setPanel('<p class="dialog-eyebrow">YOUR CAMPUS. YOUR LITTLE ACCOUNT.</p><h2 id="dialog-title">'+(signup?'Make yourself at home.':'Welcome back.')+'</h2><p class="dialog-intro">'+(signup?'Create your FoodLoop account with any email address, including Gmail.':'Sign in with your email and password, or your connected Google account.')+'</p>'+googlePlaceholder()+'<div class="auth-divider"><span>or use your email</span></div><form id="auth-form" data-mode="'+(signup?'register':'login')+'">'+(signup?'<label class="field-label" for="auth-name">Your name</label><input id="auth-name" class="auth-input" name="name" autocomplete="name" maxlength="60" required placeholder="Your name">':'')+'<label class="field-label" for="auth-email">Email address</label><input id="auth-email" class="auth-input" name="email" type="email" autocomplete="email" maxlength="254" required placeholder="you@gmail.com"><label class="field-label" for="auth-password">Password</label><div class="password-wrap"><input id="auth-password" class="auth-input" name="password" type="password" autocomplete="'+(signup?'new-password':'current-password')+'" minlength="12" maxlength="128" required placeholder="'+(signup?'At least 12 characters':'Your FoodLoop password')+'"><button type="button" data-auth-action="show-password" aria-label="Show password">Show</button></div>'+(signup?'<p class="small muted auth-password-note">Use 12–128 characters. Your password is stored as a salted hash.</p>':'')+'<button class="dark-button auth-submit" type="submit">'+(signup?'Create email account':'Sign in with email')+' <span aria-hidden="true">↗</span></button><p id="auth-status" class="auth-status" role="status"></p></form><p class="auth-switch">'+(signup?'Already at home here? <button class="text-button" data-auth-action="login">Sign in</button>':'New to FoodLoop? <button class="text-button" data-auth-action="signup">Create an account</button>')+'</p><p class="small muted auth-privacy">Create a FoodLoop account to sign in with your email. Email registration does not verify student status. You can browse without an account.</p>','account');
    if(state.googleClientId)prepareGoogle(false);
  }
  function loadGoogle(){
    if(window.google?.accounts?.id)return Promise.resolve();
    if(googleScript)return googleScript;
    googleScript=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=resolve;script.onerror=()=>{googleScript=null;reject(new Error('Google sign-in could not load. Please use email or try again.'));};document.head.appendChild(script);});return googleScript;
  }
  async function prepareGoogle(link){
    try {
      const nonce=await api('google-nonce',{});await loadGoogle();
      if(!active()||!$('#google-button-mount'))return;
      window.google.accounts.id.initialize({client_id:state.googleClientId,nonce:nonce.nonce,auto_select:false,callback:async response=>{
        if(state.busy)return;state.busy=true;status('Checking your Google account…');
        try {const result=await api(link?'link-google':'google',{credential:response.credential});state.user=result.user;updateButton();if(active())render('account');UI.toast(link?'Google is connected to your FoodLoop account.':'You’re signed in with Google.');}
        catch(error){status(error.message,true);}finally{state.busy=false;}
      }});
      const mount=$('#google-button-mount');mount.innerHTML='';
      window.google.accounts.id.renderButton(mount,{type:'standard',theme:'outline',size:'large',shape:'pill',text:link?'continue_with':'signin_with',width:Math.min(340,Math.max(220,mount.clientWidth||300))});
    }catch(error){status(error.message,true);const mount=$('#google-button-mount');if(mount)mount.innerHTML='<p class="small muted">Google could not connect. Email sign-in is still available.</p>';}
  }
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-auth-action]');if(!button)return;event.preventDefault();
    const action=button.dataset.authAction;
    if(action==='signup'||action==='login')return UI.go(action);
    if(action==='show-password'){const input=$('#auth-password'),show=input.type==='password';input.type=show?'text':'password';button.textContent=show?'Hide':'Show';button.setAttribute('aria-label',show?'Hide password':'Show password');return;}
    if(action==='logout'&&!state.busy){state.busy=true;button.disabled=true;try{await api('logout',{});state.user=null;updateButton();if(active())render('login');UI.toast('You’re signed out of FoodLoop.');}catch(error){status(error.message,true);button.disabled=false;}finally{state.busy=false;}}
  });
  document.addEventListener('submit',async event=>{
    if(event.target.id!=='auth-form')return;event.preventDefault();const form=event.target;
    if(state.busy||!form.reportValidity())return;
    state.busy=true;const button=form.querySelector('[type="submit"]');button.disabled=true;status(form.dataset.mode==='register'?'Creating your account…':'Signing you in…');
    const payload={email:form.elements.email.value,password:form.elements.password.value};if(form.elements.name)payload.name=form.elements.name.value;
    try{const result=await api(form.dataset.mode,payload);form.reset();state.user=result.user;updateButton();if(active())render('account');UI.toast('You’re signed in to FoodLoop.');}
    catch(error){status(error.message,true);button.disabled=false;}finally{payload.password='';state.busy=false;}
  });
  window.FoodLoopAuth={render};
  async function initialize(){
    if(location.protocol==='file:'){state.ready=true;updateButton();if(active())render();return;}
    try {
      const [config,session]=await Promise.all([api('config'),api('session')]);
      state.available=!!config.emailAccounts;state.googleClientId=config.googleClientId;state.user=session.user||null;
    }catch{state.available=false;}
    state.ready=true;updateButton();if(active())render(location.hash.slice(1));
  }
  initialize();
})();
