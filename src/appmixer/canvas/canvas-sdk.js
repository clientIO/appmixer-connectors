'use strict';

module.exports = class Canvas {

    constructor(accessToken, context) {

        this.axiosInstance = context.httpRequest.create({
            baseURL: 'https://canvas.instructure.com/api/v1/',
            headers: { Authorization: `Bearer ${accessToken}` }
        });
    }

    async handleResponse(promise) {

        try {
            const response = await promise;
            return response;
        } catch (error) {
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                throw new Error(`Error: ${error.response.data?.errors?.map(err => err.message).join(', ')}`);
            } else if (error.request) {
                // The request was made but no response was received
                throw new Error('Error: No response received from the server');
            } else {
                // Something happened in setting up the request that triggered an Error
                throw new Error(`Error: ${error.message}`);
            }
        }
    }

    getSelfUser() {

        return this.handleResponse(this.axiosInstance.get('/users/self'));
    }

    listCourses() {

        return this.handleResponse(this.axiosInstance.get('/courses'));
    }

    listCoursesByUserId(userId) {

        return this.handleResponse(
            this.axiosInstance.get(`/users/${userId}/courses`)
        );
    }

    listCourseEnrollmentUsers(
        courseId,
        enrollmentStatus,
        teacherId,
        gradingPeriodId,
        enrollmentTermId,
        enrollmentType
    ) {

        const params = {
            state: enrollmentStatus,
            user_id: teacherId,
            grading_period_id: gradingPeriodId,
            enrollment_term_id: enrollmentTermId,
            type: enrollmentType
        };

        return this.handleResponse(
            this.axiosInstance.get(`/courses/${courseId}/enrollments`, { params })
        );
    }

    listAssignmentGroups(courseId) {

        return this.handleResponse(
            this.axiosInstance.get(`/courses/${courseId}/assignment_groups`)
        );
    }

    createAssignment(courseId, data) {

        return this.handleResponse(
            this.axiosInstance.post(`/courses/${courseId}/assignments`, {
                assignment: data
            })
        );
    }

    getUser(userId) {

        return this.handleResponse(this.axiosInstance.get(`/users/${userId}`));
    }

    getSubmissions(courseId, assignmentId, userId, isAnonymous) {

        return this.handleResponse(
            this.axiosInstance.get(
                `courses/${courseId}/assignments/${assignmentId}/${
                    isAnonymous ? 'anonymous_submissions' : 'submissions'
                }/${userId || ''}`
            )
        );
    }

    updateSubmission(courseId, assignmentId, userId, isAnonymous, data) {

        return this.handleResponse(
            this.axiosInstance.put(
                `courses/${courseId}/assignments/${assignmentId}/${
                    isAnonymous ? 'anonymous_submissions' : 'submissions'
                }/${userId || ''}`,
                data
            )
        );
    }
};
