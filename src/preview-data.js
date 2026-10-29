// Fictional employees only. Never import the private HR roster into this preview.
const teams = [
  ['Web Development', ['Rahul Sharma', 'Aman Verma']],
  ['Video Editing', ['Priya Shah', 'Karan Mehta', 'Neha Rao', 'Arjun Patel', 'Riya Das', 'Dev Kapoor', 'Meera Joshi', 'Kabir Jain', 'Ananya Sen']],
  ['Graphic Design', ['Sana Ali', 'Aditya Singh', 'Nisha Gupta', 'Rohan Nair']],
  ['Sales', ['Vikas Kumar', 'Ishita Roy']],
];

const employees = teams.flatMap(([team, names]) =>
  names.map(name => ({
    name,
    email: name.toLowerCase().replaceAll(' ', '.') + '@example.com',
    team,
  })),
);

const summaries = {
  'Web Development': 'Completed responsive page updates and checked the contact form.\nReviewed the changes for the next release.',
  'Video Editing': 'Edited campaign footage, added captions and exported a review copy.\nOrganized the project files for the next round.',
  'Graphic Design': 'Prepared social media artwork and updated campaign graphics.\nShared the designs for review.',
  Sales: 'Followed up with enquiries and prepared proposals.\nUpdated the outreach summary for the team.',
};

export function getPreviewPayload(date) {
  const [year, month, day] = date.split('-');
  return {
    mode: 'demo',
    employees,
    reports: employees.filter((_, index) => index % 3 !== 0).map((person, index) => ({
      id: 'preview-' + index,
      email: person.email,
      date,
      time: '18:' + String(10 + index * 3).padStart(2, '0'),
      subject: `Daily Work Report - ${day}/${month}/${year}`,
      body: summaries[person.team],
    })),
  };
}
