import test from 'node:test';
import assert from 'node:assert/strict';

const base = process.env.TEST_API_URL;
test('project tasks persist, validate input, and remain company scoped', {skip: !base}, async () => {
  const call = async (path, method = 'GET', body) => {
    const response = await fetch(`${base}${path}`, {method, headers: {'Content-Type':'application/json'}, body: body && JSON.stringify(body)});
    return {status:response.status, data:await response.json()};
  };
  const projects = await call('/companies/COH/projects');
  assert.equal(projects.status, 200);
  assert.ok(projects.data.length);
  const project = projects.data[0];
  const path = `/companies/COH/projects/${project.id}/tasks`;
  const input = {title:'Integration test task',description:'Persistence verification',assignee:'Remko',priority:'HIGH',status:'TODO',dueDate:'2026-09-24'};
  for (const invalid of [{title:' '},{status:'UNKNOWN'},{priority:'URGENT'},{dueDate:'2026-02-30'},{assignee:'Unknown'}]) {
    assert.equal((await call(path,'POST',{...input,...invalid})).status,400);
  }
  assert.equal((await call(path.replace('/COH/','/QHOME/'),'POST',input)).status,404);
  const created = await call(path,'POST',input);
  assert.equal(created.status,201);
  const taskPath = `${path}/${created.data.id}`;
  try {
    const saved = (await call('/companies/COH/projects')).data.find(p=>p.id===project.id).tasks.find(t=>t.id===created.data.id);
    assert.equal(saved.title,input.title);
    assert.equal(saved.dueDate.slice(0,10),input.dueDate);
    assert.equal((await call(taskPath.replace('/COH/','/QHOME/'),'PATCH',input)).status,404);
    assert.equal((await call(taskPath.replace('/COH/','/QHOME/'),'DELETE')).status,404);
    for (const status of ['IN_PROGRESS','BLOCKED','DONE']) {
      assert.equal((await call(taskPath,'PATCH',{...input,status})).status,200);
      const task=(await call('/companies/COH/projects')).data.find(p=>p.id===project.id).tasks.find(t=>t.id===created.data.id);
      assert.equal(task.status,status);
    }
  } finally {
    assert.equal((await call(taskPath,'DELETE')).status,200);
  }
  assert.equal((await call(taskPath,'PATCH',input)).status,404);
  assert.ok(!(await call('/companies/COH/projects')).data.flatMap(p=>p.tasks).some(t=>t.id===created.data.id));
});
