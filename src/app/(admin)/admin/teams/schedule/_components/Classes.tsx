import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Plus, Trash2, Clock, Users } from "lucide-react";

const Classes = () => {
  const [classes, setClasses] = useState([
    {
      id: 1,
      name: "CrossFit WOD",
      duration: 60,
      maxParticipants: 15,
      requiredSkills: ["CrossFit Level 1"],
      description: "High-intensity functional fitness workout"
    },
    {
      id: 2,
      name: "Yoga Flow",
      duration: 45,
      maxParticipants: 20,
      requiredSkills: ["Yoga Certified"],
      description: "Dynamic vinyasa yoga practice"
    },
    {
      id: 3,
      name: "Kids Class",
      duration: 30,
      maxParticipants: 10,
      requiredSkills: ["Kids Class Certified"],
      description: "Fun fitness activities for children"
    },
    {
      id: 4,
      name: "Olympic Lifting",
      duration: 90,
      maxParticipants: 8,
      requiredSkills: ["Olympic Lifting"],
      description: "Technical weightlifting training"
    }
  ]);

  const [newClass, setNewClass] = useState({
    name: "",
    duration: "",
    maxParticipants: "",
    requiredSkills: [],
    description: ""
  });

  const availableSkills = [
    "CrossFit Level 1",
    "Yoga Certified",
    "Kids Class Certified",
    "Olympic Lifting",
    "Nutrition Coaching"
  ];

  const addClass = () => {
    if (newClass.name && newClass.duration && newClass.maxParticipants) {
      setClasses([...classes, {
        id: Date.now(),
        name: newClass.name,
        duration: parseInt(newClass.duration),
        maxParticipants: parseInt(newClass.maxParticipants),
        requiredSkills: newClass.requiredSkills,
        description: newClass.description
      }]);
      setNewClass({
        name: "",
        duration: "",
        maxParticipants: "",
        requiredSkills: [],
        description: ""
      });
    }
  };

  const removeClass = (id: number) => {
    setClasses(classes.filter(cls => cls.id !== id));
  };

  const addSkillToNewClass = (skill: string) => {
    if (!newClass.requiredSkills.includes(skill)) {
      setNewClass({
        ...newClass,
        requiredSkills: [...newClass.requiredSkills, skill]
      });
    }
  };

  const removeSkillFromNewClass = (skill: string) => {
    setNewClass({
      ...newClass,
      requiredSkills: newClass.requiredSkills.filter(s => s !== skill)
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <header className="bg-white/80 backdrop-blur-md border-b border-white/20 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-teal-500 to-blue-600 p-2 rounded-xl">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Class Catalog</h1>
              <p className="text-sm text-slate-600">Manage your gym's class offerings</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Add New Class */}
        <Card className="bg-white/60 backdrop-blur-sm border-white/20 mb-8">
          <CardHeader>
            <CardTitle>Add New Class</CardTitle>
            <CardDescription>Create a new class type for your schedule</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="className">Class Name</Label>
                <Input
                  id="className"
                  placeholder="e.g., CrossFit WOD"
                  value={newClass.name}
                  onChange={(e) => setNewClass({...newClass, name: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  placeholder="60"
                  value={newClass.duration}
                  onChange={(e) => setNewClass({...newClass, duration: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="maxParticipants">Max Participants</Label>
                <Input
                  id="maxParticipants"
                  type="number"
                  placeholder="15"
                  value={newClass.maxParticipants}
                  onChange={(e) => setNewClass({...newClass, maxParticipants: e.target.value})}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief class description..."
                value={newClass.description}
                onChange={(e) => setNewClass({...newClass, description: e.target.value})}
              />
            </div>

            <div>
              <Label>Required Skills</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {newClass.requiredSkills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="flex items-center space-x-1">
                    <span>{skill}</span>
                    <button onClick={() => removeSkillFromNewClass(skill)}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Select onValueChange={addSkillToNewClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Add required skill..." />
                </SelectTrigger>
                <SelectContent>
                  {availableSkills
                    .filter(skill => !newClass.requiredSkills.includes(skill))
                    .map((skill) => (
                      <SelectItem key={skill} value={skill}>{skill}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={addClass} className="w-full md:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Class
            </Button>
          </CardContent>
        </Card>

        {/* Existing Classes */}
        <div className="grid gap-6">
          {classes.map((classItem) => (
            <Card key={classItem.id} className="bg-white/60 backdrop-blur-sm border-white/20 hover:bg-white/80 transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="bg-gradient-to-br from-orange-500 to-pink-600 p-2 rounded-lg">
                        <BookOpen className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-slate-800">{classItem.name}</h3>
                        <p className="text-sm text-slate-600">{classItem.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 mb-4">
                      <div className="flex items-center space-x-1 text-sm text-slate-600">
                        <Clock className="h-4 w-4" />
                        <span>{classItem.duration} minutes</span>
                      </div>
                      <div className="flex items-center space-x-1 text-sm text-slate-600">
                        <Users className="h-4 w-4" />
                        <span>Max {classItem.maxParticipants} participants</span>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-slate-700 mb-2 block">Required Skills:</Label>
                      <div className="flex flex-wrap gap-2">
                        {classItem.requiredSkills.map((skill) => (
                          <Badge key={skill} variant="outline">{skill}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeClass(classItem.id)}
                    className="text-red-600 hover:text-red-700 ml-4"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Classes;
