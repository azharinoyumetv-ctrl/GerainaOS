const {test,expect}=require('./customer-audit.fixture.cjs');
for(const [role,routes] of [['cashier',['dashboard','pos']],['manager',['dashboard','staff/management']],['warehouse',['products','inventory/movement']]]){
  test.describe(role+' permitted screens',()=>{
    test.use({auditRole:role});
    for(const route of routes)test(route+' loads only APIs the employee is allowed to access',async({app:f})=>{
      await f.go('app/'+route);await expect(f.page.locator('.route-stage')).toBeVisible();await f.settle();
      expect(f.reads.filter(r=>r.status>=400),'Permitted screens must not silently fail owner-only requests').toEqual([]);
      expect(f.errors).toEqual([]);
    });
  });
}
