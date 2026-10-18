'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const project=path.resolve(__dirname,'..');
function harness(){
  const requireFromMain=createRequire(path.join(project,'main.js'));
  const app={on(){},whenReady(){return {then(){}}}};
  const context={
    require(name){if(name==='electron')return {app};return requireFromMain(name);},
    console,process,Buffer,setTimeout,clearTimeout,URL
  };
  const source=fs.readFileSync(path.join(project,'main.js'),'utf8');
  vm.runInNewContext(source+`\nglobalThis.__test={
    init(ids){tabs=new Map(ids.map(id=>[id,{id,groupId:null}]));order=[...ids];groups=new Map();nextGroupId=1;activeId=null;},
    order(){return [...order];},
    entries(){return order.map(id=>({id,groupId:tabs.get(id)?.groupId||null}));},
    groups(){return publicGroups().map(g=>({...g}));},
    createGroup,addToGroup,groupWithTab,ungroupTab,reorderTab,renameGroup,colorGroup,toggleGroup,ungroupAll
  }`,context,{filename:'main.js'});
  return context.__test;
}
test('grouping two tabs places both together',()=>{
  const t=harness();t.init([1,2,3,4]);
  assert.equal(t.groupWithTab(4,2),true);
  assert.deepEqual(Array.from(t.order()),[1,2,4,3]);
  assert.equal(t.entries()[1].groupId,1);
  assert.equal(t.entries()[2].groupId,1);
  assert.equal(t.groups().length,1);
});
test('moving a tab between groups deletes the empty group',()=>{
  const t=harness();t.init([1,2,3]);
  const a=t.createGroup(1),b=t.createGroup(2);
  assert.equal(t.addToGroup(1,b),true);
  assert.equal(t.groups().length,1);
  assert.equal(t.entries().find(x=>x.id===1).groupId,b);
  assert.equal(t.groups()[0].id,b);
  assert.ok(a!==b);
});
test('creating a group from the middle does not split the old group',()=>{
  const t=harness();t.init([1,2,3,4]);
  const first=t.createGroup(1);
  t.addToGroup(2,first);t.addToGroup(3,first);
  const second=t.createGroup(2);
  assert.deepEqual(Array.from(t.order()),[1,3,2,4]);
  assert.equal(t.entries()[0].groupId,first);
  assert.equal(t.entries()[1].groupId,first);
  assert.equal(t.entries()[2].groupId,second);
});
test('rename, recolor, collapse and ungroup all tabs',()=>{
  const t=harness();t.init([1,2,3]);
  const id=t.createGroup(1);t.addToGroup(2,id);
  assert.equal(t.renameGroup(id,'  Games  '),true);
  assert.equal(t.colorGroup(id,'cyan'),true);
  assert.equal(t.colorGroup(id,'invalid'),false);
  assert.equal(t.toggleGroup(id),true);
  assert.equal(t.groups()[0].name,'Games');
  assert.equal(t.groups()[0].color,'cyan');
  assert.equal(t.groups()[0].collapsed,true);
  assert.equal(t.ungroupAll(id),true);
  assert.equal(t.groups().length,0);
  assert.ok(t.entries().every(x=>x.groupId===null));
});
test('edge-drop moves a tab into the target group and respects order',()=>{
  const t=harness();t.init([1,2,3,4]);
  const id=t.createGroup(2);
  t.addToGroup(3,id);
  assert.equal(t.reorderTab(4,3,false),true);
  assert.deepEqual(Array.from(t.order()),[1,2,4,3]);
  assert.equal(t.entries().find(x=>x.id===4).groupId,id);
});
