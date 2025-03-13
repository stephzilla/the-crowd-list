const Parser = require('rss-parser');
const axios = require('axios').default;
const { XMLParser } = require('fast-xml-parser');
const options = {
    ignoreAttributes: false,
    attributeNamePrefix : "@_",
    removeNSPrefix: true
};
const parser = new XMLParser(options);
const airtableAdapter = require('../airtable-adapter.js');

/**
 * A service that calls the SEC Edgar API for all businesses that are crowdfunding via Reg CF
 * @param {*} event 
 * @returns {Object} List of companies that are crowdfunding
 */
exports.handler = async (event) => { 
    let url = "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&CIK=&type=C&company=&dateb=&owner=include&start=0&count=100&output=atom";
    let edgarFeed = await requestEdgarFeed(url);
    let cFeed = getListOfCFilers(edgarFeed);
    let primaryDocList = generatePrimaryDocList(cFeed);
    let parsedList = await parsePrimaryDocXML(primaryDocList);

    // store the parsed list
    return await addListToTable(parsedList);
};

/**
 * Request a feed from EDGAR
 * @param {*} feedUrl 
 * @returns {Object} 
 */
async function requestEdgarFeed(feedUrl) {
    const rssParser = new Parser({
        headers: {
            'User-Agent': 'The Crowd List hello@thecrowdlist.com'
        }
    });
    let feed = await rssParser.parseURL(feedUrl);

    return feed;
};

/**
 * Get the list of companies who have filed a Form C
 * @param {*} edgarFeed 
 * @returns 
 */
function getListOfCFilers(edgarFeed){
    let cFeed = [];

    // get only the C docs
    for (let i = 0; i < edgarFeed.items.length; i++){
        // parse title and look for "C" only
        if (edgarFeed.items[i].title.startsWith('C -')) {
            cFeed.push(edgarFeed.items[i]);
        }
    }

    return cFeed;
}

/**
 * Generate the primary list of companies
 * @param {*} parsedFeed 
 * @returns 
 */
function generatePrimaryDocList(parsedFeed){
    let primaryDocList = [];
    //parse the C docs
    for (let i = 0; i < parsedFeed.length; i++) {
        let pathAttributes = parsedFeed[i].link.split("/");
        let CIK = pathAttributes[6];
        let accessionNum = pathAttributes[7];
        //generate primaryDocXMLURL
        let primaryDocXMLURL = 'https://www.sec.gov/Archives/edgar/data/' + CIK + '/' + accessionNum + '/primary_doc.xml';
        primaryDocList.push(primaryDocXMLURL);
    }

    return primaryDocList;
}

/**
 * Parse the primary list of companies to prepare for storage
 * @param {*} primaryDocList 
 * @returns 
 */
async function parsePrimaryDocXML(primaryDocList){
    try{
        let parsedFeed = [];
        let config = {headers: {'User-Agent': 'The Crowd List hello@thecrowdlist.com'}}
        for (let i = 0; i < primaryDocList.length; i++) {
                const response = await axios.get(primaryDocList[i], config);
                let parsedResponseData = parser.parse(response.data)

                let parsedObj = {
                    companyCIK: parsedResponseData.edgarSubmission.headerData.filerInfo.filer.filerCredentials.filerCik, 
                    companyName: parsedResponseData.edgarSubmission.formData.issuerInformation.issuerInfo.nameOfIssuer,
                    companyURL: parsedResponseData.edgarSubmission.formData.issuerInformation.issuerInfo.issuerWebsite,
                    liveStatus: parsedResponseData.edgarSubmission.headerData.filerInfo.liveTestFlag,
                    fundingPortal: parsedResponseData.edgarSubmission.formData.issuerInformation.companyName,
                    maximumOfferingAmount: parsedResponseData.edgarSubmission.formData.offeringInformation.maximumOfferingAmount,
                    pricePerShare: parsedResponseData.edgarSubmission.formData.offeringInformation.price,
                    companyState: parsedResponseData.edgarSubmission.formData.issuerInformation.issuerInfo.legalStatus.jurisdictionOrganization,
                    deadlineDate: parsedResponseData.edgarSubmission.formData.offeringInformation.deadlineDate,
                    signatureDate: parsedResponseData.edgarSubmission.formData.signatureInfo.signaturePersons.signaturePerson.signatureDate
                }
                parsedFeed.push(parsedObj);
       }

       return parsedFeed;
    } catch (error) {
        console.error(error);
    }

}

/**
 * 
 * @param {*} companyCIK 
 * @returns 
 */
async function companyCIKExists(companyCIK, deadlineDate) {
        return await airtableAdapter.searchForCIK(companyCIK, deadlineDate);
}

/**
 * Store the parsed list of companies
 * @param {*} parsedList 
 */
async function addListToTable(parsedList) {
    try {
            for (let i = 0; i < parsedList.length; i++) {
                let companyExists = await companyCIKExists(parsedList[i].companyCIK, parsedList[i].deadlineDate);
                if (companyExists == true) {            
                    console.log("Company already exists in db. -- " + parsedList[i].companyCIK);
                    continue;
                } else {
                    await airtableAdapter.addToTable(
                        parsedList[i].companyName, 
                        parsedList[i].companyURL,
                        parsedList[i].companyCIK, 
                        parsedList[i].liveStatus, 
                        parsedList[i].fundingPortal, 
                        parsedList[i].maximumOfferingAmount,
                        parsedList[i].pricePerShare,
                        parsedList[i].companyState,
                        parsedList[i].deadlineDate,
                        parsedList[i].signatureDate
                    )
                }
            }
    } catch (err) {
        console.error(err);
    }
}
