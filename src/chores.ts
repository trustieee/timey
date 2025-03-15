export const CHORES = [
    "Morning: brush teeth, brush hair, deodorant",
    "Take medicine",
    "Math homework",
    "Reading (20 minutes)",
    "Additional homework ",
    "Practice piano (10 minutes)",
    "Take a shower",
    "Clean room",
    "Load or rotate laundry",
    "Take out recyclables",
    "Outside time (20 minutes)",
    "Bed: brush teeth, use bathroom",
].map((chore, index) => {
    return { id: index, text: chore, completed: false }
});