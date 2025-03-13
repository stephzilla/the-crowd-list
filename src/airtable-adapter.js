const Airtable = require('airtable');
const TABLE_NAME = 'The List';

const base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base(process.env.AIRTABLE_BASE_ID);
const table = base(TABLE_NAME);


// TODO: Add tests.

/**
 * Check if CIK already exists in DB
 * @param {*} companyCIK 
 * @returns 
 */
exports.searchForCIK = async function searchForCIK(companyCIK, deadlineDate){
  let lookupCIK = await table.select({
    filterByFormula: `AND({Company CIK} = "${companyCIK}", {Converted Deadline Date} = "${deadlineDate}")`,
    view: "Grid view"
  }).all();

  if (Array.isArray(lookupCIK) && lookupCIK.length > 0) {
    // Company already exists in DB
    return true;
  } else {
    // Company not found in DB
    return false;
  }
}


/**
 * Add a single record/item to airtable
 * @param {*} companyName 
 * @param {*} companyURL 
 * @param {*} campaignURL
 * @param {*} summary
 * @param {*} companyCIK 
 * @param {*} liveStatus 
 * @param {*} fundingPortal 
 * @param {*} maxOfferingAmount 
 * @param {*} pricePerShare 
 * @param {*} companyState  
 * @param {*} deadlineDate 
 * @param {*} dateSigned 
 */
exports.addToTable = async function addToTable(companyName, companyURL, companyCIK, liveStatus, fundingPortal, maxOfferingAmount, pricePerShare, companyState, deadlineDate, dateSigned) {
  let fields = [{
    "fields": {
      "Company Name": companyName,
      "Company URL": companyURL,
      "Company CIK" : companyCIK,
      "Live Status": liveStatus,
      "Funding Portal": fundingPortal,
      "Max Offering Amount" : maxOfferingAmount,
      "Price per Share" : pricePerShare,
      "Company State" : companyState,
      "Deadline Date" : deadlineDate,
      "Date Signed": dateSigned
    }
  }];
  let createdRecord = await table.create(fields, {typecast: true});
  console.log("Record Created: " + JSON.stringify(createdRecord));
}