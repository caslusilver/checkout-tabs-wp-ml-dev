const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {JSDOM}=require('jsdom');
const jquery=require('jquery');
function setup(t){const dom=new JSDOM('<form class="checkout"></form>',{url:'https://shop.example.test/checkout/',runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window,$=jquery(w);w.jQuery=$;w.console={log(){}};w.eval(readFileSync('assets/js/address-ml-modal.js','utf8'));return{w,$};}
test('native triggerHandler success reaches feedback without vetoing the WooCommerce redirect',t=>{
 const{w,$}=setup(t),events=[];w.CCCheckoutTabs.bindCheckoutSuccess(data=>events.push(data.result));
 const data={result:'success',redirect:'https://shop.example.test/order-received/1/?key=fixture'};
 assert.equal($('form').triggerHandler('checkout_place_order_success',[data]),undefined);assert.deepEqual(events,['success']);
 // trigger normal pode subir até body: não repetir limpeza/animação para o mesmo objeto.
 $('form').trigger('checkout_place_order_success',[data]);assert.equal(events.length,1);
 $('form').triggerHandler('checkout_place_order_success',[{result:'failure',messages:'Recusado'}]);
 $('form').triggerHandler('checkout_place_order_success',[{result:'success'}]);assert.equal(events.length,1);
});
test('form replacement rebinds success and feedback exceptions never block native navigation',t=>{
 const{w,$}=setup(t);let calls=0;w.CCCheckoutTabs.bindCheckoutSuccess(()=>{calls++;throw new Error('fixture animation failure');});
 $('form').replaceWith('<form class="woocommerce-checkout"></form>');$(w.document.body).trigger('ctwpml_woo_updated');
 const result=$('form').triggerHandler('checkout_place_order_success',[{result:'success',redirect:'/order-received/2/'}]);assert.equal(result,undefined);assert.equal(calls,1);
});
test('another gateway veto remains intact; this listener does not override its false result',t=>{
 const{w,$}=setup(t);$('form').on('checkout_place_order_success.externalGateway',()=>false);w.CCCheckoutTabs.bindCheckoutSuccess(()=>{});
 assert.equal($('form').triggerHandler('checkout_place_order_success',[{result:'success',redirect:'/order-received/3/'}]),false);
});
test('real success animation is shown only after a successful form result, then error releases it',t=>{
 const{w,$}=setup(t);w.eval(readFileSync('assets/js/cta-anim.js','utf8'));w.CCCheckoutTabs.bindCheckoutSuccess(()=>w.CTWPMLCtaAnim.completeSuccess());
 assert.equal(w.document.querySelector('#ctwpml-success-overlay'),null);
 $('form').triggerHandler('checkout_place_order_success',[{result:'failure'}]);assert.equal(w.document.querySelector('#ctwpml-success-overlay'),null);
 $('form').triggerHandler('checkout_place_order_success',[{result:'success',redirect:'/order-received/4/'}]);
 assert.equal(w.document.querySelector('#ctwpml-success-overlay').getAttribute('aria-hidden'),'false');
 assert.equal(w.document.querySelector('.ctwpml-success-progress-percent').textContent,'100%');
 $(w.document.body).trigger('checkout_error');assert.equal(w.document.querySelector('#ctwpml-success-overlay').getAttribute('aria-hidden'),'true');
});

test('final checkout indicator survives background address preparation until an explicit terminal result',t=>{
 const{w,$}=setup(t);w.cc_params={};w.eval(readFileSync('assets/js/preparing-checkout.js','utf8'));
 w.CTWPMLPrepare.showPreparingOverlay('Finalizando seu pedido…','checkout');
 w.CTWPMLPrepare.showPreparingOverlay('Atualizando endereço');
 assert.equal(w.document.querySelector('.ctwpml-preparing-title').textContent,'Finalizando seu pedido…');
 assert.equal(w.document.querySelector('#ctwpml-preparing-overlay').classList.contains('is-visible'),true);
 assert.equal(w.document.querySelector('#ctwpml-preparing-overlay').classList.contains('is-finalizing'),true);
 assert.equal(w.document.querySelector('#ctwpml-success-overlay'),null);
 w.CTWPMLPrepare.hidePreparingOverlay();
 assert.equal(w.document.querySelector('#ctwpml-preparing-overlay').classList.contains('is-visible'),false);
});
