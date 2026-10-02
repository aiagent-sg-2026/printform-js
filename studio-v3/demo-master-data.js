// Entirely fictional, local-only business masters. Identifiers are not bank accounts.
const address = (id, label, street, city) => ({id, label, street, city, country:'Malaysia', formatted:`${street}\n${city}, Malaysia`});
export const DEMO_MASTER_DATA = {
  company:{id:'company:printform-demo',name:'Lantern Works Demo Sdn. Bhd. (Fictional)',registration:'DEMO-REG-2026',email:'accounts@lantern-works.example',addressId:'address:office'},
  addresses:[
    address('address:office','Lantern Works office','12 Fictional Workshop Lane','Kuala Lumpur'),
    address('address:warehouse','Lantern Works warehouse','8 Sample Logistics Avenue','Shah Alam'),
    address('address:customer-1','Amber Canopy billing','21 Demo Orchard Road','Petaling Jaya'),
    address('address:site-1','Amber Canopy site','4 Fictional Conservatory Lane','Petaling Jaya'),
    address('address:customer-2','Blue Finch billing','36 Example Harbour Street','Johor Bahru'),
    address('address:site-2','Blue Finch site','9 Demo Receiving Road','Johor Bahru'),
    address('address:customer-3','Copper Fern billing','52 Sample Learning Avenue','Penang'),
    address('address:site-3','Copper Fern site','18 Fictional Campus Road','Penang'),
    address('address:supplier-1','Willow supplier','7 Demo Foundry Street','Shah Alam'),
    address('address:supplier-2','Silver Kite supplier','14 Example Circuit Road','Johor Bahru'),
    address('address:supplier-3','Juniper supplier','26 Sample Assembly Lane','Penang')
  ],
  customers:[
    {id:'customer:amber',name:'Amber Canopy Facilities (Fictional)',email:'orders@amber-canopy.example',billingAddressId:'address:customer-1',shippingAddressId:'address:site-1',creditTermId:'credit:30'},
    {id:'customer:finch',name:'Blue Finch Workshops (Fictional)',email:'buying@blue-finch.example',billingAddressId:'address:customer-2',shippingAddressId:'address:site-2',creditTermId:'credit:14'},
    {id:'customer:fern',name:'Copper Fern Learning Hub (Fictional)',email:'purchasing@copper-fern.example',billingAddressId:'address:customer-3',shippingAddressId:'address:site-3',creditTermId:'credit:30'}
  ],
  suppliers:[
    {id:'supplier:willow',name:'Willow Bench Components (Fictional)',email:'sales@willow-bench.example',addressId:'address:supplier-1',creditTermId:'credit:30'},
    {id:'supplier:kite',name:'Silver Kite Controls (Fictional)',email:'sales@silver-kite.example',addressId:'address:supplier-2',creditTermId:'credit:14'},
    {id:'supplier:juniper',name:'Juniper Assembly Services (Fictional)',email:'sales@juniper-assembly.example',addressId:'address:supplier-3',creditTermId:'credit:30'}
  ],
  salespeople:[
    {id:'person:mira',name:'Mira Example',email:'mira@lantern-works.example',departmentId:'department:sales'},
    {id:'person:daniel',name:'Daniel Sample',email:'daniel@lantern-works.example',departmentId:'department:projects'},
    {id:'person:hana',name:'Hana Demo',email:'hana@lantern-works.example',departmentId:'department:sales'}
  ],
  departments:[{id:'department:sales',name:'Sales & customer care'},{id:'department:projects',name:'Project delivery'},{id:'department:finance',name:'Finance & purchasing'}],
  businessUnits:[{id:'bu:systems',name:'Building systems'},{id:'bu:service',name:'Field services'}],
  quotationTerms:[
    {id:'quote:30',name:'Valid for 30 days',validDays:30,text:'Prices valid for 30 days; scope changes require a revised quotation.'},
    {id:'quote:14',name:'Valid for 14 days',validDays:14,text:'Prices valid for 14 days; delivery dates are confirmed on order acceptance.'}
  ],
  creditTerms:[{id:'credit:30',name:'Net 30',days:30},{id:'credit:14',name:'Net 14',days:14},{id:'credit:0',name:'Due on receipt',days:0}],
  bankAccounts:[{id:'bank:demo-clearing',name:'Fictional clearing ledger',reference:'DEMO-ONLY-NO-BANK-ACCOUNT',currency:'MYR'}],
  products:[
    {id:'product:panel',sku:'DEMO-CTRL-01',description:'Modular lighting control panel',unit:'unit',saleRateMinor:128075,purchaseRateMinor:84525},
    {id:'product:sensor',sku:'DEMO-SENS-02',description:'Occupancy sensor with mounting kit',unit:'unit',saleRateMinor:18735,purchaseRateMinor:11620},
    {id:'product:cable',sku:'DEMO-CABL-03',description:'Shielded signal cable, 5 metre roll',unit:'roll',saleRateMinor:4265,purchaseRateMinor:2780},
    {id:'product:bracket',sku:'DEMO-BRKT-04',description:'Powder-coated safety bracket set',unit:'set',saleRateMinor:6375,purchaseRateMinor:4140},
    {id:'product:service',sku:'DEMO-SERV-05',description:'On-site commissioning and handover',unit:'hour',saleRateMinor:15000,purchaseRateMinor:9750}
  ],
  currencies:[{id:'MYR',code:'MYR',minorUnitDigits:2,symbol:'RM'},{id:'USD',code:'USD',minorUnitDigits:2,symbol:'US$'}],
  taxCodes:[{id:'tax:demo8',name:'Illustrative 8% demo tax',rateBps:800},{id:'tax:zero',name:'No tax in this fixture',rateBps:0}]
};
export function demoMaster(collection,id) {
  const values = collection === 'company' ? [DEMO_MASTER_DATA.company] : DEMO_MASTER_DATA[collection];
  const found = values?.find(value => value.id === id);
  if (!found) throw new Error(`Unknown demo master: ${collection}/${id}`);
  return structuredClone(found);
}
export const demoAddress = id => demoMaster('addresses',id).formatted;
export function demoParty(collection,id) {
  const party = demoMaster(collection,id);
  return {...party,address:demoAddress(party.billingAddressId || party.addressId)};
}
export const cloneDemoMasters = () => structuredClone(DEMO_MASTER_DATA);
