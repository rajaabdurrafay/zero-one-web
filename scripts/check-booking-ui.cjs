// Presentation-only check: reads the local catalog and changes UI selections; never submits a booking.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
async function main(){
  const base=process.env.BOOKING_QA_URL||'http://localhost:3002';
  if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Local QA URL required.');
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    for(const [mode,width] of [['DARK',1625],['LIGHT',390],['DARK',320]]){
      const context=await browser.newContext({viewport:{width,height:892},reducedMotion:'reduce'});
      await context.addInitScript(value=>localStorage.setItem('zeroone-theme-mode',value),mode);
      const page=await context.newPage();
      await page.goto(base+'/book');
      await page.getByRole('button',{name:/Car Simulator/}).click();
      await page.getByRole('button',{name:/Continue to Date/}).click();
      const dates=page.locator('.zo-booking-option.snap-start');
      await dates.first().waitFor();
      for(const index of [0,1]){
        await dates.nth(index).click();
        assert.equal(await dates.nth(index).getAttribute('aria-pressed'),'true');
        const geometry=await dates.evaluateAll(nodes=>nodes.map(n=>({radius:getComputedStyle(n).borderRadius,height:n.getBoundingClientRect().height})));
        assert.equal(new Set(geometry.map(n=>n.radius)).size,1);
        assert.equal(new Set(geometry.map(n=>n.height)).size,1);
        assert.equal(geometry[0].radius,'14px');
      }
      const durations=page.locator('.zo-booking-option:not(.snap-start)');
      await durations.first().click();
      const style=await durations.evaluateAll(nodes=>nodes.map(n=>({radius:getComputedStyle(n).borderRadius,height:n.getBoundingClientRect().height})));
      assert(style.every(n=>n.radius==='14px'&&n.height>=44));
      const actions=page.locator('.zo-action');
      const actionStyle=await actions.evaluateAll(nodes=>nodes.map(n=>({radius:getComputedStyle(n).borderRadius,height:n.getBoundingClientRect().height})));
      assert(actionStyle.length>=2);
      assert(actionStyle.every(n=>n.radius==='100px'&&n.height>=48));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      if(process.env.BOOKING_QA_OUTPUT){fs.mkdirSync(process.env.BOOKING_QA_OUTPUT,{recursive:true});await page.screenshot({path:path.join(process.env.BOOKING_QA_OUTPUT,`booking-${mode.toLowerCase()}-${width}.png`),fullPage:true});}
      console.log(`${mode} ${width}px: selection geometry, action buttons and overflow PASS`);
      await page.goto(base+'/contact');
      const subject=page.getByRole('combobox',{name:'Subject'});
      await subject.selectOption('Private Cinema Booking');
      assert.equal(await subject.inputValue(),'Private Cinema Booking');
      await subject.focus();
      await subject.press('Space');
      if(process.env.BOOKING_QA_OUTPUT)await page.screenshot({path:path.join(process.env.BOOKING_QA_OUTPUT,`dropdown-${mode.toLowerCase()}-${width}.png`)});
      await subject.press('Escape');
      const selectStyle=await subject.evaluate(n=>({radius:getComputedStyle(n).borderRadius,height:n.getBoundingClientRect().height}));
      assert.equal(selectStyle.radius,'14px');
      assert(selectStyle.height>=48);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.goto(base+'/');
      const experience=page.getByRole('combobox',{name:'Your preferred experience'});
      const activity=await experience.locator('option').nth(1).getAttribute('value');
      await experience.selectOption(activity);
      assert.equal(await experience.evaluate(n=>new FormData(n.form).get('activity')),activity);
      console.log(`${mode} ${width}px: contact/home dropdown selection and form value PASS`);
      await context.close();
    }
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
