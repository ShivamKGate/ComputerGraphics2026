// A. 

let addTwoNumber = (a, b) => {
    return a + b;
}

// B.

let stringLength = (myStr) => {
    if (myStr.length < 10) 
        return "short";
    return "long";
};

// 3. this function takes two number, and then compares them to print the larger number. if a is greater than b, then a gets printed, if not, then b gets printed.

let fn = (a,b) => { a>b ? console.log(a) : console.log(b) }
