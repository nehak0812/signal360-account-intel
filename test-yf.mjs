import { YahooFinance } from 'yahoo-finance2';
async function test() {
  try {
    const yf = new YahooFinance();
    const res = await yf.quoteSummary('ULVR.L', { modules: ['price']});
    console.log(Object.keys(res));
  } catch (e) {
    console.error(e);
  }
}
test();
