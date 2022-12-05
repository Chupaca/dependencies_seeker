const axios = require("axios");
const list_services = require("./repo_list");
const fs = require("fs")
const regex = new RegExp(/^\d+(\.\d+)*$/);
const {
    exec
} = require("child_process")

async function getLastCommit(repo, branch) {
    try {
        let result = await axios({
            url: `https://api.bitbucket.org/2.0/repositories/${process.env.PROJECT}/${repo}/commits/${branch}`,
            auth: {
                username: process.env.APP_USER,
                password: process.env.APP_PASS
            }
        })
        if (result && result.data && result.data.values && result.data.values.length) {
            console.log(repo);
            let pack = await getPackageJSON(repo, result.data.values[0].hash);
            if (pack) return pack;
            throw `Error get package.json repo: ${repo}, branch: ${branch}, commit : ${result.data.values[0].hash}`;
        }
        throw `Error get commit repo: ${repo}, branch: ${branch}`;
    } catch (error) {
        console.error(error);
        return false;
    }
}


async function getPackageJSON(repo, hash) {
    let res = await axios({
        url: `https://api.bitbucket.org/2.0/repositories/${process.env.PROJECT}/${repo}/src/${hash}/package.json`,
        auth: {
            username: process.env.APP_USER,
            password: process.env.APP_PASS
        }
    })

    return res ? res.data : null
}

async function createFile(text, file_name, type) {
    try {

        fs.writeFileSync(file_name, type == "utf8" ? text : JSON.stringify(text), type);
        return;
    } catch (err) {
        console.error(err);
    }
}


async function statisticsCSV(dependencies) {

    let all_dependencies = Object.entries(dependencies).map(([key, value]) => {
        return [...(Object.keys(value))]
    }).flat()

    let summery_dif_packages = all_dependencies.filter((x, i, arr) => arr.indexOf(x) == i);

    console.log(`Count packages: ${summery_dif_packages.length}`);

    let statistics = ["N", "packages", ...Object.keys(dependencies).sort(), "latest version"].join(",") + "\r\n";

    for (let i = 0; i < summery_dif_packages.length; i++) {
        let key = summery_dif_packages[i];
        let raw = []
        raw.push(i)
        raw.push(key)
        Object.keys(dependencies).sort().forEach(function (name) {
            let pack = Object.entries(dependencies[name]).find(function (item) {
                return item[0] == key
            })
            if (pack) {
                raw.push(pack[1]);
            } else {
                raw.push("-");
            }
        })

        let last_version = await promiseExec(`npm show ${key} version`);
        console.log("Latest of package " + key + " : " + last_version[0]);
        raw.push(last_version[0])
        statistics += raw.join(",") + "\r\n"
    }
    return statistics;
}



async function statisticsJSON(dependencies) {

    let all_dependencies = Object.entries(dependencies).map(([key, value]) => {
        return [...(Object.keys(value))]
    }).flat()

    let summery_dif_packages = all_dependencies.filter((x, i, arr) => arr.indexOf(x) == i);

    console.log(`Count packages: ${summery_dif_packages.length}`);

    let statistics = [];

    summery_dif_packages.forEach(function (key, index) {
        statistics[index] = {
            "package_name": key
        };
        Object.keys(dependencies).forEach(function (name) {
            let pack = Object.entries(dependencies[name]).find(function (item) {
                return item[0] == key
            })
            if (pack) {
                statistics[index][name] = pack[1];
            } else {
                statistics[index][name] = "";
            }
        })
    })

    console.log(statistics);
    return JSON.stringify(statistics);
}

async function statisticsHTML(dependencies) {

    let all_dependencies = Object.entries(dependencies).map(([key, value]) => {
        return [...(Object.keys(value))]
    }).flat()

    let summery_dif_packages = all_dependencies.filter((x, i, arr) => arr.indexOf(x) == i);

    console.log(`Count packages: ${summery_dif_packages.length}`);
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
</head>
<body><table><tr >`;
    let statistics_headers = ["N", "packages", ...Object.keys(dependencies).sort(), "latest version"];

    statistics_headers.forEach(element => {
        html += `<th bgcolor=#fded6566>${element}</th>`;
    });
    html += `</tr>`
    let arr_Pr = [];
    for (let i = 0; i < summery_dif_packages.length; i++) {
        arr_Pr.push(insertTo(dependencies, summery_dif_packages[i], i));
        if (!(i % 10) || i == summery_dif_packages.length - 1) {
            let result = await Promise.all(arr_Pr);
            html += result.join("");
            arr_Pr = [];
        }
    }

    html += `</table></body></html>`;
    return html;
}

async function insertTo(dependencies, n_key, i) {
    try {
        let html = `<tr>`;
        let key = n_key;
        let raw = []
        raw.push(i)
        raw.push(key)
        Object.keys(dependencies).sort().forEach(function (name) {
            let pack = Object.entries(dependencies[name]).find(function (item) {
                return item[0] == key
            })
            if (pack) {
                raw.push(pack[1]);
            } else {
                raw.push("-");
            }
        })

        let last_version = await promiseExec(`npm show ${key} version`);
        console.log("Latest of package " + key + " : " + last_version[0]);
        raw.forEach((element, i) => {
            let color = "";
            if (i > 1) {
                if (element !== "-") {

                    color = element.replace(/\D/g, "") != last_version[0].replace(/\D/g, "") ? "bgcolor=#f3b3b3" : "bgcolor=#b3f3b5"
                }
            } else {
                color = "bgcolor=#fded6566";
            }
            html += `<td ${color}>${element}</td>`;
        });
        html += `<td bgcolor=#fded6566 >${last_version[0]}</td></tr>`;

        return html;
    } catch (error) {
        return null;
    }
}


function getDependenciesFromLocalFile() {
    let dependencies = {}
    let packages = JSON.parse(
        fs.readFileSync("repo_packages.json", "utf8")
    );
    for (const key in packages) {
        dependencies[key] = {
            ...packages[key].dependencies,
            ...packages[key].devDependencies
        }
    }
    return dependencies;
}

function promiseExec(query) {
    return new Promise((resolve, reject) => {
        exec(query, (err, stdout, stderr) => {
            if (err) {
                console.error(err);
                resolve(["version not exists"])
            }
            let result;
            if (stdout) {
                result = stdout.split("\n").map(item => item.trim()).filter(item => !!item == true)
            } else if (stderr) {
                result = stderr.split("\n").map(item => item.trim()).filter(item => !!item == true)
            }

            resolve(result);
        });
    })
}

function validation() {
    if (!process.env.APP_USER || !process.env.APP_PASS) {
        throw "Error : your username or password not valid to connection to git! Follow the instructions in the README file to run the script correctly."
    }
    if (!!Object.entries(list_services).find(([key, value]) => !value)) {
        throw "Error : please check the services list for the relevant versions! Follow the instructions in the README file to run the script correctly."
    }
}

async function getDependenciesFromRemote() {
    let packages = {};
    let dependencies = {};
    for (const key in list_services) {
        if (list_services.hasOwnProperty(key)) {
            let package = await getLastCommit(key, list_services[key]);
            if (package) {
                packages[key] = package;
                dependencies[key] = {
                    ...package.dependencies,
                    ...package.devDependencies
                }
            }
        }
    }
    return [
        dependencies,
        packages
    ]
}

(async () => {
    try {
        console.log("START!");

        let dependencies = {};
        let packages = {};
        let statistic = null;
        validation();

        if (process.env.LOCAL) {
            //get package from json file
            [
                dependencies,
                packages
            ] = getDependenciesFromLocalFile();
        } else {
            //get package by the list remote repositories
            [
                dependencies,
                packages
            ] = await getDependenciesFromRemote();
        }


        switch (process.env.TYPE) {
            case 1:
                statistic = await statisticsJSON()
                createFile(statistic, "statistics.json", "utf8");
                break;
            case 2:
                statistic = await statisticsCSV(dependencies);
                createFile(statistic, "statistics.csv", "utf8");
                break;
            case 3:
                statistic = await statisticsHTML(dependencies);
                createFile(statistic, "statistics.html", "utf8");
                break;
            case 4:
                createFile(packages, "repo_packages.json", "ascii");
                break;

        }

        console.log("FINISH!");
    } catch (error) {
        console.error(error);
        process.exit(0)
    }

})()