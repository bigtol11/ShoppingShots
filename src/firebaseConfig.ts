// Firebase client config. This is NOT a secret — Firebase's own docs confirm this config is
// safe to expose in client-side code; access control is enforced server-side (see server.ts's
// ALLOWED_EMAILS check on Google ID tokens), not by hiding these values.
export const firebaseConfig = {
  apiKey: 'AIzaSyCt29VgVvHXVpcRdOTefmcpAp47miIj9tE',
  authDomain: 'shoppingshots-prod.firebaseapp.com',
  projectId: 'shoppingshots-prod',
  storageBucket: 'shoppingshots-prod.firebasestorage.app',
  messagingSenderId: '823154324409',
  appId: '1:823154324409:web:fe5d5e79ea6a6568887c68'
};
