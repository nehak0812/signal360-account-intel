import YahooFinance from 'yahoo-finance2';
async function test() {
  try {
    const yf = new YahooFinance();
    const res = await yf.quoteSummary('ULVR.L', { modules: ['assetProfile']});
    console.log(res.assetProfile.companyOfficers.slice(0, 3));
  } catch (e) {
    console.error(e);
  }
}
test();
